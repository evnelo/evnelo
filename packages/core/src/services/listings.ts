import { and, asc, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { attendees, checkIns, orders, orderItems, organizations, ticketTypes, tickets, type Attendee, type Database, type Event, type Order, type TicketType } from "@evnelo/db";
import { fromDbDatetime } from "./checkin";
import type { EventInput } from "./events";
import type { TicketTypeInput } from "./tickets";

/**
 * Paginated listings and detail views for the REST API. The dashboard pages have their own
 * bounded queries; these take `limit`/`offset` and carry the extra columns an integrator needs
 * (ticket ids, check-in state, order items) so one call answers the common questions.
 */

export type Page = { limit?: number; offset?: number };
const page = (p: Page, max: number) => ({ limit: Math.min(Math.max(p.limit ?? 50, 1), max), offset: Math.max(p.offset ?? 0, 0) });

/* ---------- organization & ticket types ---------- */

export async function getOrganization(db: Database, organizationId: string) {
  const [org] = await db.select().from(organizations).where(and(eq(organizations.id, organizationId), isNull(organizations.deletedAt))).limit(1);
  return org ?? null;
}

export async function getTicketType(db: Database, eventId: string, ticketTypeId: string) {
  const [row] = await db.select().from(ticketTypes).where(and(eq(ticketTypes.id, ticketTypeId), eq(ticketTypes.eventId, eventId))).limit(1);
  return row ?? null;
}

/* ---------- attendees ---------- */

export type AttendeeFilterPage = Page & { q?: string; status?: Attendee["status"] };

const activeCheckInAt = sql<string | Date | null>`(select max(c.created_at) from ${checkIns} c where c.ticket_id = ${tickets.id} and c.undone_at is null)`;

function attendeeSelect(db: Database) {
  const host = db.$with("host").as(db.select({ id: attendees.id, name: attendees.name }).from(attendees));
  return db.with(host).select({
    attendee: attendees,
    ticketId: tickets.id, ticketToken: tickets.token, ticketRevokedAt: tickets.revokedAt, checkedInAt: activeCheckInAt,
    ticketTypeName: ticketTypes.name, orderStatus: orders.status, orderTotalMinor: orders.totalMinor, orderCurrency: orders.currency, hostName: host.name,
  })
    .from(attendees)
    .leftJoin(tickets, eq(tickets.attendeeId, attendees.id))
    .innerJoin(ticketTypes, eq(attendees.ticketTypeId, ticketTypes.id))
    .innerJoin(orders, eq(attendees.orderId, orders.id))
    .leftJoin(host, eq(host.id, attendees.guestOfAttendeeId));
}

type AttendeeRow = Awaited<ReturnType<ReturnType<typeof attendeeSelect>["execute"]>>[number];
const attendeeView = (r: AttendeeRow) => ({ ...r, checkedInAt: fromDbDatetime(r.checkedInAt) });
export type AttendeeView = ReturnType<typeof attendeeView>;

/** Newest first. `q` matches name, email or phone. Ask for `limit + 1` rows to learn whether a next page exists. */
export async function listAttendeesPage(db: Database, eventId: string, filter: AttendeeFilterPage = {}): Promise<AttendeeView[]> {
  const where = [eq(attendees.eventId, eventId), isNull(attendees.deletedAt)];
  if (filter.status) where.push(eq(attendees.status, filter.status));
  if (filter.q?.trim()) {
    const q = `%${filter.q.trim()}%`;
    where.push(or(like(attendees.name, q), like(attendees.email, q), like(attendees.phone, q))!);
  }
  const { limit, offset } = page(filter, 201);
  const rows = await attendeeSelect(db).where(and(...where)).orderBy(desc(attendees.createdAt), desc(attendees.id)).limit(limit).offset(offset);
  return rows.map(attendeeView);
}

export async function getAttendeeView(db: Database, eventId: string, attendeeId: string): Promise<AttendeeView | null> {
  const [row] = await attendeeSelect(db).where(and(eq(attendees.id, attendeeId), eq(attendees.eventId, eventId), isNull(attendees.deletedAt))).limit(1);
  return row ? attendeeView(row) : null;
}

/* ---------- orders ---------- */

export type OrderFilterPage = Page & { status?: Order["status"]; email?: string };

/** Newest first, with the attendee count and the buyer (the first non-guest attendee). */
export async function listOrdersPage(db: Database, eventId: string, filter: OrderFilterPage = {}) {
  const where = [eq(orders.eventId, eventId)];
  if (filter.status) where.push(eq(orders.status, filter.status));
  if (filter.email?.trim()) where.push(eq(orders.email, filter.email.trim().toLowerCase()));
  const { limit, offset } = page(filter, 201);
  const rows = await db
    .select({
      order: orders,
      // raw `orders.id` on purpose: see the note in events.ts about correlated subqueries
      attendeeCount: sql<number>`(select count(*) from ${attendees} a where a.order_id = orders.id)`,
      buyerName: sql<string | null>`(select a.name from ${attendees} a where a.order_id = orders.id and a.guest_of_attendee_id is null limit 1)`,
    })
    .from(orders)
    .where(and(...where))
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({ ...r, attendeeCount: Number(r.attendeeCount) }));
}

/** One order with its line items (ticket type name included) and every attendee in the party. */
export async function getOrderDetails(db: Database, eventId: string, orderId: string) {
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.eventId, eventId))).limit(1);
  if (!order) return null;
  const [items, party] = await Promise.all([
    db.select({ id: orderItems.id, ticketTypeId: orderItems.ticketTypeId, ticketTypeName: ticketTypes.name, quantity: orderItems.quantity, unitPriceMinor: orderItems.unitPriceMinor })
      .from(orderItems).innerJoin(ticketTypes, eq(ticketTypes.id, orderItems.ticketTypeId)).where(eq(orderItems.orderId, orderId)),
    attendeeSelect(db).where(and(eq(attendees.orderId, orderId), isNull(attendees.deletedAt))).orderBy(asc(attendees.createdAt), asc(attendees.id)),
  ]);
  return { order, items, attendees: party.map(attendeeView) };
}

/* ---------- check-ins ---------- */

/** Active (not undone) check-ins, newest first. */
export async function listCheckInsPage(db: Database, eventId: string, filter: Page = {}) {
  const { limit, offset } = page(filter, 201);
  return db
    .select({ id: checkIns.id, ticketId: checkIns.ticketId, attendeeId: attendees.id, name: attendees.name, email: attendees.email, ticketTypeName: ticketTypes.name, method: checkIns.method, checkedInAt: checkIns.createdAt })
    .from(checkIns)
    .innerJoin(tickets, eq(tickets.id, checkIns.ticketId))
    .innerJoin(attendees, eq(attendees.id, tickets.attendeeId))
    .innerJoin(ticketTypes, eq(ticketTypes.id, attendees.ticketTypeId))
    .where(and(eq(checkIns.eventId, eventId), isNull(checkIns.undoneAt)))
    .orderBy(desc(checkIns.createdAt), desc(checkIns.id))
    .limit(limit)
    .offset(offset);
}

/* ---------- PATCH support: current record → the full input the update services take ---------- */

type EventRecord = {
  event: Event;
  hosts: Array<{ name: string; title: string | null; avatarUrl: string | null; socialLinks: Event["socialLinks"] }>;
  sponsors: Array<{ name: string; logoUrl: string | null; tier: string | null; website: string | null; socialLinks: Event["socialLinks"] }>;
  tags: Array<{ name: string; slug: string }>;
};

/**
 * The stored event as `eventInput` would have accepted it, so a partial update can be merged on
 * top and re-validated as a whole (the update service replaces every field and relation).
 */
export function eventInputFromRecord({ event: e, hosts, sponsors, tags }: EventRecord): EventInput {
  return {
    name: e.name, slug: e.slug, descriptionMd: e.descriptionMd, coverImageUrl: e.coverImageUrl,
    timezone: e.timezone, startsAt: e.startsAt, endsAt: e.endsAt, locationType: e.locationType,
    venueName: e.venueName, address: e.address, city: e.city, country: e.country, lat: e.lat, lng: e.lng, onlineUrl: e.onlineUrl,
    visibility: e.visibility, requiresApproval: e.requiresApproval, capacity: e.capacity, waitlistEnabled: e.waitlistEnabled,
    collectPhone: e.collectPhone, guestsEnabled: e.guestsEnabled, maxGuests: e.maxGuests, feePassThrough: e.feePassThrough,
    refundPolicy: e.refundPolicy, socialLinks: e.socialLinks, reminderHours: e.reminderHours,
    tags: tags.map((t) => t.name),
    hosts: hosts.map((h) => ({ name: h.name, title: h.title, avatarUrl: h.avatarUrl, socialLinks: h.socialLinks })),
    sponsors: sponsors.map((s) => ({ name: s.name, logoUrl: s.logoUrl, tier: s.tier, website: s.website, socialLinks: s.socialLinks })),
  };
}

export function ticketTypeInputFromRecord(t: TicketType): TicketTypeInput {
  return {
    name: t.name, description: t.description, priceMinor: t.priceMinor, currency: t.currency, quantity: t.quantity,
    minPerOrder: t.minPerOrder, maxPerOrder: t.maxPerOrder, salesStartAt: t.salesStartAt, salesEndAt: t.salesEndAt,
    hidden: t.hidden, accessCode: t.accessCode, taxRateBps: t.taxRateBps,
  };
}

/** Rows a list endpoint fetched with `limit + 1` from `offset`: the page plus the offset of the next one, if any. */
export function paginate<T>(rows: T[], limit: number, offset: number) {
  return { data: rows.slice(0, limit), pagination: { limit, offset, nextOffset: rows.length > limit ? offset + limit : null } };
}

/** Same shape for small, bounded lists that are fetched whole (ticket types, codes, invites, webhooks). */
export function paginateAll<T>(rows: T[], limit: number, offset: number) {
  return paginate(rows.slice(offset, offset + limit + 1), limit, offset);
}

export const ATTENDEE_STATUSES = ["pending_approval", "confirmed", "rejected", "cancelled", "waitlisted"] as const satisfies readonly Attendee["status"][];
export const ORDER_STATUSES = ["pending", "processing", "paid", "free", "refunded", "partially_refunded", "failed", "expired"] as const satisfies readonly Order["status"][];
