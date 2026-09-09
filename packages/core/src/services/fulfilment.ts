import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { attendees, notifications, orders, orderItems, ticketTypes, tickets, type Attendee, type Database } from "@ot/db";
import { newId } from "../ids";
import type { DbOrTx } from "./db";

/**
 * Order fulfilment: tickets, seats and the notification rows that go with them.
 * Used by the checkout route, the Stripe webhook, and the dashboard approval flow.
 */

export function newTicketToken() {
  return randomBytes(24).toString("base64url");
}

/** Queue one email per distinct address in `rows`, attributed to the first attendee with that address. */
export async function queueEmailPerAddress(tx: DbOrTx, organizationId: string, template: string, rows: Attendee[], data?: Record<string, unknown>) {
  const seen = new Set<string>();
  for (const a of rows) {
    if (seen.has(a.email)) continue;
    seen.add(a.email);
    await tx.insert(notifications).values({
      id: newId(), organizationId, eventId: a.eventId, attendeeId: a.id, channel: "email", template, recipient: a.email, data: data ?? null,
    });
  }
}

/**
 * One ticket per confirmed attendee (guests included). Confirmation goes to each distinct
 * email in the party; a guest without their own address shares the host's, and the host's
 * confirmation carries every ticket for that address.
 */
export async function issueTickets(tx: DbOrTx, organizationId: string, rows: Attendee[]) {
  const confirmed = rows.filter((a) => a.status === "confirmed");
  for (const a of confirmed) {
    await tx.insert(tickets).values({ id: newId(), attendeeId: a.id, eventId: a.eventId, token: newTicketToken() });
  }
  await queueEmailPerAddress(tx, organizationId, "registration_confirmation", confirmed);
  for (const a of confirmed) {
    if (a.phone && a.smsOptIn) {
      await tx.insert(notifications).values({
        id: newId(), organizationId, eventId: a.eventId, attendeeId: a.id, channel: "sms", template: "confirmation", recipient: a.phone,
      });
    }
  }
}

/** Free orders skip Stripe: tickets right away, or an approval-pending email when the host reviews registrations. */
export async function fulfilFreeOrder(db: Database, orderId: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return;
    const rows = await tx.select().from(attendees).where(eq(attendees.orderId, orderId));
    await queueEmailPerAddress(tx, order.organizationId, "approval_pending", rows.filter((a) => a.status === "pending_approval"));
    await issueTickets(tx, order.organizationId, rows);
  });
}

/**
 * Move an order to paid, convert holds to sales, issue tickets (or queue the approval-pending
 * email when the host reviews registrations). Accepts `pending` and `expired` orders: Stripe
 * can confirm a PaymentIntent after the hold lapsed, and the buyer has paid either way.
 */
export async function markOrderPaid(db: Database, paymentIntentId: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.stripePaymentIntentId, paymentIntentId)).for("update");
    if (!order || (order.status !== "pending" && order.status !== "expired")) return;
    const stillHeld = order.status === "pending";

    await tx.update(orders).set({ status: "paid", paidAt: new Date() }).where(eq(orders.id, order.id));
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      await tx.update(ticketTypes)
        .set({ sold: sql`${ticketTypes.sold} + ${item.quantity}`, ...(stillHeld ? { held: sql`GREATEST(${ticketTypes.held} - ${item.quantity}, 0)` } : {}) })
        .where(eq(ticketTypes.id, item.ticketTypeId));
    }
    const rows = await tx.select().from(attendees).where(eq(attendees.orderId, order.id));
    await queueEmailPerAddress(tx, order.organizationId, "approval_pending", rows.filter((a) => a.status === "pending_approval"));
    await issueTickets(tx, order.organizationId, rows);
  });
}

/** Give a pending order's inventory back. Atomic: only one caller wins against a concurrent markOrderPaid. */
export async function releaseOrder(db: Database, orderId: string, status: "failed" | "expired") {
  return db.transaction(async (tx) => {
    const [res] = await tx.update(orders).set({ status }).where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
    if (res.affectedRows === 0) return false;
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const item of items) {
      await tx.update(ticketTypes).set({ held: sql`GREATEST(${ticketTypes.held} - ${item.quantity}, 0)` }).where(eq(ticketTypes.id, item.ticketTypeId));
    }
    return true;
  });
}

export async function releaseOrderByPaymentIntent(db: Database, paymentIntentId: string, status: "failed" | "expired") {
  const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.stripePaymentIntentId, paymentIntentId)).limit(1);
  if (order) await releaseOrder(db, order.id, status);
}

/** Release holds on pending orders whose window has passed. Called before each new order until a job runner picks it up. */
export async function expireHolds(db: Database, limit = 100) {
  const stale = await db.select({ id: orders.id }).from(orders)
    .where(and(eq(orders.status, "pending"), lt(orders.holdExpiresAt, new Date())))
    .limit(limit);
  let released = 0;
  for (const o of stale) if (await releaseOrder(db, o.id, "expired")) released++;
  return released;
}

/**
 * Record a refund. Partial refunds only store the amount (the organizer decides which seat,
 * if any, is lost). A full refund cancels the party: tickets revoked, seats returned, email queued.
 */
export async function applyRefund(db: Database, refund: { paymentIntentId: string; amountRefunded: number; amount: number }) {
  const full = refund.amountRefunded >= refund.amount;
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.stripePaymentIntentId, refund.paymentIntentId)).for("update");
    if (!order) return;
    await tx.update(orders)
      .set({ refundedMinor: refund.amountRefunded, status: full ? "refunded" : "partially_refunded" })
      .where(eq(orders.id, order.id));
    if (!full || order.status === "refunded") return;
    await cancelParty(tx, order.id, order.organizationId, order.status === "paid" || order.status === "partially_refunded", "refund_issued");
  });
}

/** Revoke a whole order's tickets, cancel its attendees, return seats, queue one email. */
export async function cancelParty(tx: DbOrTx, orderId: string, organizationId: string, returnSeats: boolean, template: string | null) {
  const party = await tx.select().from(attendees).where(and(eq(attendees.orderId, orderId), isNull(attendees.deletedAt)));
  if (party.length) {
    await tx.update(tickets).set({ revokedAt: new Date() }).where(and(inArray(tickets.attendeeId, party.map((a) => a.id)), isNull(tickets.revokedAt)));
    await tx.update(attendees).set({ status: "cancelled" }).where(eq(attendees.orderId, orderId));
  }
  if (returnSeats) {
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const item of items) {
      await tx.update(ticketTypes).set({ sold: sql`GREATEST(${ticketTypes.sold} - ${item.quantity}, 0)` }).where(eq(ticketTypes.id, item.ticketTypeId));
    }
  }
  const host = party.find((a) => !a.guestOfAttendeeId) ?? party[0];
  if (template && host) await queueEmailPerAddress(tx, organizationId, template, [host]);
}
