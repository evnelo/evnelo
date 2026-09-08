import { and, eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { attendees, notifications, orders, orderItems, ticketTypes, tickets } from "@ot/db";
import { newId } from "@ot/core";
import { randomBytes } from "node:crypto";
import { db } from "./db";

/** Move a pending order to paid, convert holds to sales, issue tickets, queue confirmations. */
export async function markOrderPaid(paymentIntentId: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.stripePaymentIntentId, paymentIntentId)).for("update");
    if (!order || order.status !== "pending") return; // already processed or unknown

    await tx.update(orders).set({ status: "paid", paidAt: new Date() }).where(eq(orders.id, order.id));

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      await tx.update(ticketTypes)
        .set({ sold: sql`${ticketTypes.sold} + ${item.quantity}`, held: sql`${ticketTypes.held} - ${item.quantity}` })
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
