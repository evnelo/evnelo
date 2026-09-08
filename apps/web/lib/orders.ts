import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { attendees, notifications, orders, orderItems, ticketTypes, tickets } from "@ot/db";
import { newId } from "@ot/core";
import { randomBytes } from "node:crypto";
import { db } from "./db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * One ticket per attendee (guests included). Confirmation goes to each distinct email in the
 * party: a guest without their own address shares the host's, and the host's confirmation
 * carries every ticket in the order.
 */
async function issueTickets(tx: Tx, organizationId: string, rows: (typeof attendees.$inferSelect)[]) {
  const notified = new Set<string>();
  for (const a of rows) {
    await tx.insert(tickets).values({ id: newId(), attendeeId: a.id, eventId: a.eventId, token: randomBytes(24).toString("base64url") });
    if (!notified.has(a.email)) {
      notified.add(a.email);
      await tx.insert(notifications).values({
        id: newId(), organizationId, eventId: a.eventId, attendeeId: a.id,
        channel: "email", template: "registration_confirmation", recipient: a.email,
      });
    }
    if (a.phone && a.smsOptIn) {
      await tx.insert(notifications).values({
        id: newId(), organizationId, eventId: a.eventId, attendeeId: a.id,
        channel: "sms", template: "confirmation", recipient: a.phone,
      });
    }
  }
}

/**
 * Move an order to paid, convert holds to sales, issue tickets, queue confirmations.
 * Accepts `pending` and `expired` orders: Stripe can confirm a PaymentIntent after the
 * 10-minute hold lapsed, and the buyer has paid, so they get their ticket either way.
 */
export async function markOrderPaid(paymentIntentId: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.stripePaymentIntentId, paymentIntentId)).for("update");
    if (!order || (order.status !== "pending" && order.status !== "expired")) return; // already processed or unknown
    const stillHeld = order.status === "pending"; // expired orders already gave their hold back

    await tx.update(orders).set({ status: "paid", paidAt: new Date() }).where(eq(orders.id, order.id));

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      await tx.update(ticketTypes)
        .set({
          sold: sql`${ticketTypes.sold} + ${item.quantity}`,
          ...(stillHeld ? { held: sql`GREATEST(${ticketTypes.held} - ${item.quantity}, 0)` } : {}),
        })
        .where(eq(ticketTypes.id, item.ticketTypeId));
    }

    const orderAttendees = await tx.select().from(attendees).where(eq(attendees.orderId, order.id));
    await issueTickets(tx, order.organizationId, orderAttendees);
  });
}

/**
 * Give a pending order's inventory back. Used when the PaymentIntent could not be created,
 * when Stripe cancels it, and when the hold expires. Atomic: the conditional UPDATE means
 * only one caller (this, or a concurrent markOrderPaid) wins.
 */
export async function releaseOrder(orderId: string, status: "failed" | "expired") {
  return db.transaction(async (tx) => {
    const [res] = await tx.update(orders).set({ status }).where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
    if (res.affectedRows === 0) return false;
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const item of items) {
      await tx.update(ticketTypes)
        .set({ held: sql`GREATEST(${ticketTypes.held} - ${item.quantity}, 0)` })
        .where(eq(ticketTypes.id, item.ticketTypeId));
    }
    return true;
  });
}

export async function releaseOrderByPaymentIntent(paymentIntentId: string, status: "failed" | "expired") {
  const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.stripePaymentIntentId, paymentIntentId)).limit(1);
  if (order) await releaseOrder(order.id, status);
}

/**
 * Release holds on pending orders whose 10-minute window has passed.
 * Until the job runner exists this is called opportunistically before each new order,
 * so expired holds free inventory for the next buyer.
 */
export async function expireHolds(limit = 100) {
  const stale = await db.select({ id: orders.id }).from(orders)
    .where(and(eq(orders.status, "pending"), lt(orders.holdExpiresAt, new Date())))
    .limit(limit);
  let released = 0;
  for (const o of stale) if (await releaseOrder(o.id, "expired")) released++;
  return released;
}

/**
 * Stripe charge.refunded. Partial refunds only record the amount (the organizer decides
 * which attendee, if any, loses a seat). A full refund cancels the whole party: tickets
 * revoked so they no longer scan, seats returned to inventory, refund email queued.
 */
export async function applyRefund(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;
  const full = charge.amount_refunded >= charge.amount;
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.stripePaymentIntentId, piId)).for("update");
    if (!order) return;
    await tx.update(orders)
      .set({ refundedMinor: charge.amount_refunded, status: full ? "refunded" : "partially_refunded" })
      .where(eq(orders.id, order.id));
    if (!full || order.status === "refunded") return; // idempotent: cancel the party once

    const now = new Date();
    const party = await tx.select().from(attendees).where(and(eq(attendees.orderId, order.id), isNull(attendees.deletedAt)));
    if (party.length) {
      await tx.update(tickets).set({ revokedAt: now }).where(and(inArray(tickets.attendeeId, party.map((a) => a.id)), isNull(tickets.revokedAt)));
      await tx.update(attendees).set({ status: "cancelled" }).where(eq(attendees.orderId, order.id));
    }
    // seats go back only if this order had actually consumed them
    if (order.status === "paid" || order.status === "partially_refunded") {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      for (const item of items) {
        await tx.update(ticketTypes).set({ sold: sql`GREATEST(${ticketTypes.sold} - ${item.quantity}, 0)` }).where(eq(ticketTypes.id, item.ticketTypeId));
      }
    }
    const host = party.find((a) => !a.guestOfAttendeeId) ?? party[0];
    if (host) {
      await tx.insert(notifications).values({
        id: newId(), organizationId: order.organizationId, eventId: order.eventId, attendeeId: host.id,
        channel: "email", template: "refund_issued", recipient: order.email,
      });
    }
  });
}

/** Free orders skip Stripe: issue tickets and queue confirmations right away (unless approval is required). */
export async function fulfilFreeOrder(orderId: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return;
    const rows = await tx.select().from(attendees).where(eq(attendees.orderId, orderId));
    const pending = rows.filter((a) => a.status === "pending_approval");
    for (const a of pending) {
      if (a.guestOfAttendeeId) continue; // the host hears about the whole party
      await tx.insert(notifications).values({ id: newId(), organizationId: order.organizationId, eventId: a.eventId, attendeeId: a.id, channel: "email", template: "approval_pending", recipient: a.email });
    }
    await issueTickets(tx, order.organizationId, rows.filter((a) => a.status !== "pending_approval"));
  });
}
