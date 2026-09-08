import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { attendees, events, orders, orderItems, organizations, registrationFields, ticketTypes } from "@ot/db";
import { buildAnswersSchema, computeOrder, currentEdition, newId } from "@ot/core";
import { db } from "@/lib/db";
import { createOrderPaymentIntent } from "@/lib/stripe";

export const runtime = "nodejs";
const HOLD_MINUTES = 10;

const body = z.object({
  eventId: z.string().length(26),
  ticketTypeId: z.string().length(26),
  quantity: z.number().int().min(1).max(10).default(1),
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional().or(z.literal("")),
  smsOptIn: z.boolean().optional(),
  attendee: z.record(z.unknown()).default({}),
  order: z.record(z.unknown()).default({}),
});

/**
 * Creates an order for one ticket type.
 * Free → attendees confirmed immediately (or pending approval) and order status "free".
 * Paid → inventory held for 10 min, PaymentIntent returned for the Payment Element.
 * Inventory is guarded with a conditional UPDATE so flash sales can't oversell.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the form and try again.", issues: parsed.error.issues }, { status: 400 });
  const input = parsed.data;

  const [event] = await db.select().from(events).where(eq(events.id, input.eventId)).limit(1);
  if (!event || event.status !== "published") return NextResponse.json({ error: "This event isn't open for registration." }, { status: 404 });
  const [tt] = await db.select().from(ticketTypes).where(and(eq(ticketTypes.id, input.ticketTypeId), eq(ticketTypes.eventId, event.id))).limit(1);
  if (!tt) return NextResponse.json({ error: "That ticket isn't available." }, { status: 404 });
  const now = new Date();
  if ((tt.salesStartAt && tt.salesStartAt > now) || (tt.salesEndAt && tt.salesEndAt < now)) return NextResponse.json({ error: "Sales for this ticket are closed." }, { status: 409 });
  if (input.quantity < tt.minPerOrder || input.quantity > tt.maxPerOrder) return NextResponse.json({ error: `Choose between ${tt.minPerOrder} and ${tt.maxPerOrder} tickets.` }, { status: 400 });

  // server-side validation of custom fields with the same schema the browser used
  const fields = await db.select().from(registrationFields).where(eq(registrationFields.eventId, event.id));
  const att = buildAnswersSchema(fields, { scope: "attendee", ticketTypeId: tt.id }).safeParse(input.attendee);
  const ord = buildAnswersSchema(fields, { scope: "order" }).safeParse(input.order);
  if (!att.success || !ord.success) {
    return NextResponse.json({ error: "Some answers need attention.", issues: [...(att.success ? [] : att.error.issues), ...(ord.success ? [] : ord.error.issues)] }, { status: 400 });
  }

  const [org] = await db.select().from(organizations).where(eq(organizations.id, event.organizationId)).limit(1);
  const edition = currentEdition();
  const fees = computeOrder([{ unitPriceMinor: tt.priceMinor, quantity: input.quantity, taxRateBps: tt.taxRateBps }], { edition, feePassThrough: event.feePassThrough });
  const isFree = fees.totalMinor === 0;
  const orderId = newId();

  const result = await db.transaction(async (tx) => {
    // atomic inventory reservation
    const reserve = await tx.update(ticketTypes)
      .set(isFree ? { sold: sql`${ticketTypes.sold} + ${input.quantity}` } : { held: sql`${ticketTypes.held} + ${input.quantity}` })
      .where(and(
        eq(ticketTypes.id, tt.id),
        tt.quantity == null ? sql`1=1` : sql`${ticketTypes.sold} + ${ticketTypes.held} + ${input.quantity} <= ${ticketTypes.quantity}`,
      ));
    if (reserve[0].affectedRows === 0) return { soldOut: true as const };

    await tx.insert(orders).values({
      id: orderId, eventId: event.id, organizationId: event.organizationId, email: input.email,
      status: isFree ? "free" : "pending", currency: tt.currency,
      subtotalMinor: fees.subtotalMinor, taxMinor: fees.taxMinor, serviceFeeMinor: fees.serviceFeeMinor,
      totalMinor: fees.totalMinor, platformFeeMinor: fees.platformFeeMinor,
      holdExpiresAt: isFree ? null : new Date(now.getTime() + HOLD_MINUTES * 60_000),
      paidAt: isFree ? now : null, answers: ord.data, stripeAccountId: org?.stripeAccountId ?? null,
    });
    await tx.insert(orderItems).values({ id: newId(), orderId, ticketTypeId: tt.id, quantity: input.quantity, unitPriceMinor: tt.priceMinor });
    await tx.insert(attendees).values({
      id: newId(), eventId: event.id, orderId, ticketTypeId: tt.id, name: input.name, email: input.email,
      phone: input.phone || null, smsOptIn: Boolean(input.smsOptIn && input.phone),
      status: event.requiresApproval ? "pending_approval" : "confirmed", answers: att.data,
    });
    return { soldOut: false as const };
  });
  if (result.soldOut) return NextResponse.json({ error: "That ticket just sold out." }, { status: 409 });

  if (isFree) {
    const { fulfilFreeOrder } = await import("@/lib/orders");
    await fulfilFreeOrder(orderId);
    return NextResponse.json({ orderId });
  }

  const pi = await createOrderPaymentIntent({
    orderId, amountMinor: fees.totalMinor, currency: tt.currency, platformFeeMinor: fees.platformFeeMinor,
    stripeAccountId: org?.stripeAccountId, receiptEmail: input.email,
  });
  await db.update(orders).set({ stripePaymentIntentId: pi.id }).where(eq(orders.id, orderId));
  return NextResponse.json({ orderId, clientSecret: pi.client_secret, stripeAccountId: org?.stripeAccountId ?? null });
}
