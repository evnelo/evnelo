import { and, asc, desc, eq, gte, inArray, isNull, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  attendees, checkIns, eventHosts, eventSponsors, eventTags, events, notifications, orders, organizations, tags, ticketTypes,
  type Database, type Event, type SocialLink,
} from "@ot/db";
import { newId } from "../ids";
import { slugify, slugSuffix } from "../slug";
import type { DbOrTx } from "./db";
import { queueEmailPerAddress } from "./fulfilment";

/* ---------- input ---------- */

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable().optional();
const urlOrEmpty = (max: number) => z.string().trim().max(max).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}, "Must be a valid http:// or https:// URL").transform((v) => v || null).nullable().optional();

import { SOCIAL_PLATFORMS } from "../constants";
export const socialLinkInput = z.object({ platform: z.enum(SOCIAL_PLATFORMS), url: z.string().trim().url() });

export const hostInput = z.object({
  name: z.string().trim().min(1).max(120), title: text(120), avatarUrl: urlOrEmpty(500), socialLinks: z.array(socialLinkInput).default([]),
});
export const sponsorInput = z.object({
  name: z.string().trim().min(1).max(120), logoUrl: urlOrEmpty(500), tier: text(60), website: urlOrEmpty(300), socialLinks: z.array(socialLinkInput).default([]),
});

export const eventInput = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().regex(/^[a-z0-9-]{3,80}$/, "Lowercase letters, numbers and hyphens").optional(),
  descriptionMd: text(20_000),
  coverImageUrl: urlOrEmpty(500),
  logoUrl: urlOrEmpty(500),
  timezone: z.string().trim().min(1).max(64),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  locationType: z.enum(["in_person", "online", "hybrid"]).default("in_person"),
  venueName: text(160),
  address: text(300),
  city: text(100),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).or(z.literal("")).transform((v) => v || null).nullable().optional(),
  lat: text(20),
  lng: text(20),
  onlineUrl: urlOrEmpty(500),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
  requiresApproval: z.boolean().default(false),
  capacity: z.coerce.number().int().min(1).nullable().optional(),
  waitlistEnabled: z.boolean().default(false),
  collectPhone: z.boolean().default(false),
  guestsEnabled: z.boolean().default(false),
  maxGuests: z.coerce.number().int().min(1).max(20).default(1),
  feePassThrough: z.boolean().default(false),
  refundPolicy: text(5_000),
  socialLinks: z.array(socialLinkInput).default([]),
  reminderHours: z.array(z.coerce.number().int().min(1).max(24 * 14)).max(4).default([24, 1]),
  tags: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  hosts: z.array(hostInput).max(20).default([]),
  sponsors: z.array(sponsorInput).max(50).default([]),
}).refine((e) => e.endsAt > e.startsAt, { message: "The event must end after it starts.", path: ["endsAt"] });
export type EventInput = z.infer<typeof eventInput>;

/* ---------- helpers ---------- */

function columns(input: EventInput) {
  const { tags: _t, hosts: _h, sponsors: _s, slug: _slug, ...rest } = input;
  return {
    ...rest,
    socialLinks: rest.socialLinks as SocialLink[],
    capacity: rest.capacity ?? null,
    country: rest.country ?? null,
  };
}

function isDuplicateEntryError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY";
}

async function insertEventWithUniqueSlug(db: DbOrTx, orgId: string, input: EventInput) {
  const base = input.slug ?? slugify(input.name);
  for (let attempt = 0; attempt < 6; attempt++) {
    const id = newId();
    const slug = attempt === 0 ? base : `${base}-${slugSuffix()}`;
    try {
      await db.insert(events).values({ id, organizationId: orgId, slug, ...columns(input) });
      return { id, slug };
    } catch (error) {
      if (!isDuplicateEntryError(error) || attempt === 5) throw error;
    }
  }
  throw new Error("Unable to allocate an event slug.");
}

async function updateEventWithUniqueSlug(db: DbOrTx, eventId: string, currentSlug: string, input: EventInput) {
  const base = input.slug && input.slug !== currentSlug ? input.slug : currentSlug;
  const attempts = base === currentSlug ? 1 : 6;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${slugSuffix()}`;
    try {
      await db.update(events).set({ slug, ...columns(input) }).where(eq(events.id, eventId));
      return;
    } catch (error) {
      if (!isDuplicateEntryError(error) || attempt === attempts - 1) throw error;
    }
  }
}

async function setRelations(db: DbOrTx, eventId: string, input: Pick<EventInput, "tags" | "hosts" | "sponsors">) {
  await db.delete(eventHosts).where(eq(eventHosts.eventId, eventId));
  if (input.hosts.length) {
    await db.insert(eventHosts).values(input.hosts.map((h, i) => ({ id: newId(), eventId, name: h.name, title: h.title ?? null, avatarUrl: h.avatarUrl ?? null, socialLinks: h.socialLinks as SocialLink[], position: i })));
  }
  await db.delete(eventSponsors).where(eq(eventSponsors.eventId, eventId));
  if (input.sponsors.length) {
    await db.insert(eventSponsors).values(input.sponsors.map((s, i) => ({ id: newId(), eventId, name: s.name, logoUrl: s.logoUrl ?? null, tier: s.tier ?? null, website: s.website ?? null, socialLinks: s.socialLinks as SocialLink[], position: i })));
  }
  await db.delete(eventTags).where(eq(eventTags.eventId, eventId));
  const namesBySlug = new Map(input.tags.map((name) => [slugify(name.trim(), 60), name.trim()]));
  for (const [slug, name] of namesBySlug) {
    await db.insert(tags).values({ id: newId(), slug, name })
      .onDuplicateKeyUpdate({ set: { name: sql`${tags.name}` } });
    const [tag] = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).limit(1);
    if (!tag) throw new Error(`Unable to resolve tag "${name}".`);
    await db.insert(eventTags).values({ eventId, tagId: tag.id });
  }
}

/* ---------- commands ---------- */

export async function createEvent(db: DbOrTx, orgId: string, input: EventInput): Promise<Event> {
  return db.transaction(async (tx) => {
    const { id } = await insertEventWithUniqueSlug(tx, orgId, input);
    await setRelations(tx, id, input);
    return (await getEvent(tx, id))!;
  });
}

export type EventChanges = { schedule: boolean; venue: boolean };

/**
 * Update every field. When a published event's time or place changes, attendees get an
 * "event updated" email (and SMS where opted in) queued automatically.
 */
export async function updateEvent(db: Database, eventId: string, input: EventInput): Promise<{ event: Event; changes: EventChanges }> {
  const result = await db.transaction(async (tx) => {
    const before = await getEvent(tx, eventId);
    if (!before) throw new Error("Event not found.");
    await updateEventWithUniqueSlug(tx, eventId, before.slug, input);
    await setRelations(tx, eventId, input);
    const after = (await getEvent(tx, eventId))!;
    const changes: EventChanges = {
      schedule: before.startsAt.getTime() !== after.startsAt.getTime() || before.endsAt.getTime() !== after.endsAt.getTime() || before.timezone !== after.timezone,
      venue: before.locationType !== after.locationType || before.venueName !== after.venueName || before.address !== after.address || before.city !== after.city || before.onlineUrl !== after.onlineUrl,
    };
    return { event: after, changes };
  });
  const { event: after, changes } = result;
  if (after.status === "published" && (changes.schedule || changes.venue)) await queueEventUpdate(db, after, changes);
  return result;
}

async function liveAttendees(db: Database, eventId: string) {
  return db.select().from(attendees).where(and(eq(attendees.eventId, eventId), inArray(attendees.status, ["confirmed", "pending_approval"]), isNull(attendees.deletedAt)));
}

export async function queueEventUpdate(db: Database, event: Event, changes: EventChanges) {
  const rows = await liveAttendees(db, event.id);
  await queueEmailPerAddress(db, event.organizationId, "event_updated", rows, { changes });
  for (const a of rows) {
    if (a.phone && a.smsOptIn) {
      await db.insert(notifications).values({ id: newId(), organizationId: event.organizationId, eventId: event.id, attendeeId: a.id, channel: "sms", template: "updated", recipient: a.phone });
    }
  }
}

/** Draft → published. A free "General admission" ticket is created when the event has none, so registration works immediately. */
export async function publishEvent(db: Database, eventId: string) {
  const event = await getEvent(db, eventId);
  if (!event) throw new Error("Event not found.");
  if (event.status === "cancelled") throw new Error("A cancelled event can't be published again. Duplicate it instead.");
  const [tt] = await db.select({ id: ticketTypes.id }).from(ticketTypes).where(eq(ticketTypes.eventId, eventId)).limit(1);
  if (!tt) await db.insert(ticketTypes).values({ id: newId(), eventId, name: "General admission", priceMinor: 0, quantity: event.capacity ?? null });
  await db.update(events).set({ status: "published", publishedAt: event.publishedAt ?? new Date() }).where(eq(events.id, eventId));
  return (await getEvent(db, eventId))!;
}

export async function unpublishEvent(db: Database, eventId: string) {
  await db.update(events).set({ status: "draft" }).where(and(eq(events.id, eventId), eq(events.status, "published")));
}

/** Cancel: attendees are told by email (and SMS where opted in). Refunds for paid orders are issued separately from the Orders tab. */
export async function cancelEvent(db: Database, eventId: string) {
  const event = await getEvent(db, eventId);
  if (!event) throw new Error("Event not found.");
  if (event.status === "cancelled") return event;
  await db.update(events).set({ status: "cancelled" }).where(eq(events.id, eventId));
  const rows = await liveAttendees(db, eventId);
  await queueEmailPerAddress(db, event.organizationId, "event_cancelled", rows);
  for (const a of rows) {
    if (a.phone && a.smsOptIn) {
      await db.insert(notifications).values({ id: newId(), organizationId: event.organizationId, eventId, attendeeId: a.id, channel: "sms", template: "cancelled", recipient: a.phone });
    }
  }
  return (await getEvent(db, eventId))!;
}

export async function deleteEvent(db: Database, eventId: string) {
  await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, eventId));
}

/* ---------- queries ---------- */

export async function getEvent(db: DbOrTx, eventId: string) {
  const [e] = await db.select().from(events).where(and(eq(events.id, eventId), isNull(events.deletedAt))).limit(1);
  return e ?? null;
}

export async function getEventWithRelations(db: Database, eventId: string) {
  const event = await getEvent(db, eventId);
  if (!event) return null;
  const [hosts, sponsors, tagRows, types] = await Promise.all([
    db.select().from(eventHosts).where(eq(eventHosts.eventId, eventId)).orderBy(asc(eventHosts.position)),
    db.select().from(eventSponsors).where(eq(eventSponsors.eventId, eventId)).orderBy(asc(eventSponsors.position)),
    db.select({ name: tags.name, slug: tags.slug }).from(eventTags).innerJoin(tags, eq(eventTags.tagId, tags.id)).where(eq(eventTags.eventId, eventId)),
    db.select().from(ticketTypes).where(eq(ticketTypes.eventId, eventId)).orderBy(asc(ticketTypes.position), asc(ticketTypes.createdAt)),
  ]);
  return { event, hosts, sponsors, tags: tagRows, ticketTypes: types };
}

// Correlated subqueries. The outer column is written as raw `events.id`: drizzle would render
// `${events.id}` as a bare `id` here, which MySQL resolves to the inner table.
const registrations = sql<number>`(select count(*) from ${attendees} a where a.event_id = events.id and a.status = 'confirmed' and a.deleted_at is null)`;
const pending = sql<number>`(select count(*) from ${attendees} a where a.event_id = events.id and a.status = 'pending_approval' and a.deleted_at is null)`;
const revenue = sql<number>`(select coalesce(sum(o.total_minor - o.refunded_minor), 0) from ${orders} o where o.event_id = events.id and o.status in ('paid','partially_refunded'))`;
const checkedIn = sql<number>`(select count(*) from ${checkIns} c where c.event_id = events.id and c.undone_at is null)`;

export async function listOrgEvents(db: Database, orgId: string, status?: Event["status"]) {
  const where = [eq(events.organizationId, orgId), isNull(events.deletedAt)];
  if (status) where.push(eq(events.status, status));
  const rows = await db
    .select({ event: events, registrations, pending, revenue, checkedIn })
    .from(events)
    .where(and(...where))
    .orderBy(desc(events.startsAt));
  return rows.map((r) => ({ ...r, registrations: Number(r.registrations), pending: Number(r.pending), revenue: Number(r.revenue), checkedIn: Number(r.checkedIn) }));
}

export type PublicEventSearch = { query?: string; city?: string; tag?: string; limit?: number };

/** Public-safe discovery projection used by the web UI and unauthenticated API. */
export async function listPublicEvents(db: Database, opts: PublicEventSearch = {}) {
  const where = [eq(events.visibility, "public"), eq(events.status, "published"), isNull(events.deletedAt), gte(events.endsAt, new Date())];
  if (opts.city) where.push(eq(events.city, opts.city));
  if (opts.tag) {
    where.push(sql<boolean>`exists (select 1 from ${eventTags} et join ${tags} t on t.id = et.tag_id where et.event_id = events.id and (t.slug = ${opts.tag} or t.name = ${opts.tag}))`);
  }
  if (opts.query) {
    const term = opts.query.trim();
    if (term.length < 3) {
      const prefix = `${term}%`;
      where.push(or(
        like(events.name, prefix), like(events.city, prefix), like(organizations.name, prefix),
        sql<boolean>`exists (select 1 from ${eventTags} et join ${tags} t on t.id = et.tag_id where et.event_id = events.id and t.name like ${prefix})`,
      )!);
    } else {
      where.push(or(
        sql<boolean>`match(${events.name}, ${events.descriptionMd}) against (${term} in natural language mode)`,
        sql<boolean>`match(${organizations.name}) against (${term} in natural language mode)`,
        sql<boolean>`exists (select 1 from ${eventTags} et join ${tags} t on t.id = et.tag_id where et.event_id = events.id and match(t.name) against (${term} in natural language mode))`,
      )!);
    }
  }
  return db
    .select({
      id: events.id, slug: events.slug, name: events.name, descriptionMd: events.descriptionMd, coverImageUrl: events.coverImageUrl,
      startsAt: events.startsAt, endsAt: events.endsAt, timezone: events.timezone, city: events.city, country: events.country,
      locationType: events.locationType, venueName: events.venueName, organizationId: organizations.id, orgName: organizations.name,
    })
    .from(events)
    .innerJoin(organizations, eq(events.organizationId, organizations.id))
    .where(and(...where))
    .orderBy(asc(events.startsAt))
    .limit(Math.min(Math.max(opts.limit ?? 48, 1), 100));
}

export async function getEventStats(db: Database, eventId: string) {
  const [row] = await db.select({ registrations, pending, revenue, checkedIn, currency: sql<string>`(select o.currency from ${orders} o where o.event_id = events.id limit 1)` })
    .from(events).where(eq(events.id, eventId)).limit(1);
  const byTicketType = await db.select({ id: ticketTypes.id, name: ticketTypes.name, priceMinor: ticketTypes.priceMinor, currency: ticketTypes.currency, sold: ticketTypes.sold, held: ticketTypes.held, quantity: ticketTypes.quantity })
    .from(ticketTypes).where(eq(ticketTypes.eventId, eventId)).orderBy(asc(ticketTypes.position));
  const byDay = await db.select({ day: sql<string>`date(${attendees.createdAt})`, count: sql<number>`count(*)` })
    .from(attendees).where(and(eq(attendees.eventId, eventId), isNull(attendees.deletedAt), inArray(attendees.status, ["confirmed", "pending_approval"])))
    .groupBy(sql`date(${attendees.createdAt})`).orderBy(sql`date(${attendees.createdAt})`);
  return {
    registrations: Number(row?.registrations ?? 0), pending: Number(row?.pending ?? 0), revenue: Number(row?.revenue ?? 0), checkedIn: Number(row?.checkedIn ?? 0),
    currency: row?.currency ?? byTicketType[0]?.currency ?? "USD",
    byTicketType, byDay: byDay.map((d) => ({ day: String(d.day), count: Number(d.count) })),
  };
}
