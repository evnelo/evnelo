import { eq } from "drizzle-orm";
import { attendees, events, orderItems, orders } from "@evnelo/db";
import type { DbOrTx } from "./db";

/** What subscribers receive. Stable, documented shapes; ids are ULIDs, money is minor units. */
export type OrderPayload = {
  id: string; eventId: string; status: string; email: string; currency: string;
  subtotalMinor: number; discountMinor: number; taxMinor: number; serviceFeeMinor: number; totalMinor: number; refundedMinor: number;
  paidAt: string | null; createdAt: string;
  items: { ticketTypeId: string; quantity: number; unitPriceMinor: number }[];
  attendees: { id: string; name: string; email: string; status: string; ticketTypeId: string; guestOfAttendeeId: string | null }[];
};

export async function orderPayload(tx: DbOrTx, orderId: string): Promise<OrderPayload | null> {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const [items, party] = await Promise.all([
    tx.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    tx.select().from(attendees).where(eq(attendees.orderId, orderId)),
  ]);
  return {
    id: order.id, eventId: order.eventId, status: order.status, email: order.email, currency: order.currency,
    subtotalMinor: order.subtotalMinor, discountMinor: order.discountMinor, taxMinor: order.taxMinor, serviceFeeMinor: order.serviceFeeMinor, totalMinor: order.totalMinor, refundedMinor: order.refundedMinor,
    paidAt: order.paidAt?.toISOString() ?? null, createdAt: order.createdAt.toISOString(),
    items: items.map((i) => ({ ticketTypeId: i.ticketTypeId, quantity: i.quantity, unitPriceMinor: i.unitPriceMinor })),
    attendees: party.map((a) => ({ id: a.id, name: a.name, email: a.email, status: a.status, ticketTypeId: a.ticketTypeId, guestOfAttendeeId: a.guestOfAttendeeId })),
  };
}

export type EventPayload = { id: string; organizationId: string; slug: string; name: string; status: string; visibility: string; startsAt: string; endsAt: string; timezone: string; updatedAt: string };

export async function eventPayload(tx: DbOrTx, eventId: string): Promise<EventPayload | null> {
  const [e] = await tx.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!e) return null;
  return { id: e.id, organizationId: e.organizationId, slug: e.slug, name: e.name, status: e.status, visibility: e.visibility, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(), timezone: e.timezone, updatedAt: e.updatedAt.toISOString() };
}
