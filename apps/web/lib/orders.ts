import { and, eq, lt, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { attendees, notifications, orders, orderItems, ticketTypes, tickets } from "@ot/db";
import { newId } from "@ot/core";
import { randomBytes } from "node:crypto";
import { db } from "./db";

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
    for (const a of orderAttendees) {
      await tx.insert(tickets).values({ id: newId(), attendeeId: a.id, eventId: a.eventId, token: randomBytes(24).toString("base64url") });
      await tx.insert(notifications).values({
        id: newId(), organizationId: order.organizationId, eventId: a.eventId, attendeeId: a.id,
        channel: "email", template: "registration_confirmation", recipient: a.email,
      });
      if (a.phone && a.smsOptIn) {
        await tx.insert(notifications).values({
          id: newId(), organizationId: order.organizationId, eventId: a.eventId, attendeeId: a.id,
          channel: "sms", template: "confirmation", recipient: a.phone,
        });
      }
    }
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

export async function applyRefund(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;
  const full = charge.amount_refunded >= charge.amount;
  await db.update(orders)
    .set({ refundedMinor: charge.amount_refunded, status: full ? "refunded" : "partially_refunded" })
    .where(and(eq(orders.stripePaymentIntentId, piId)));
}

/** Free orders skip Stripe: issue tickets and queue confirmations right away (unless approval is required). */
export async function fulfilFreeOrder(orderId: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return;
    const rows = await tx.select().from(attendees).where(eq(attendees.orderId, orderId));
    for (const a of rows) {
      if (a.status === "pending_approval") {
        await tx.insert(notifications).values({ id: newId(), organizationId: order.organizationId, eventId: a.eventId, attendeeId: a.id, channel: "email", template: "approval_pending", recipient: a.email });
        continue;
      }
      await tx.insert(tickets).values({ id: newId(), attendeeId: a.id, eventId: a.eventId, token: randomBytes(24).toString("base64url") });
      await tx.insert(notifications).values({ id: newId(), organizationId: order.organizationId, eventId: a.eventId, attendeeId: a.id, channel: "email", template: "registration_confirmation", recipient: a.email });
      if (a.phone && a.smsOptIn) {
        await tx.insert(notifications).values({ id: newId(), organizationId: order.organizationId, eventId: a.eventId, attendeeId: a.id, channel: "sms", template: "confirmation", recipient: a.phone });
      }
    }
  });
}
