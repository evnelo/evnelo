import { and, asc, eq, gte, isNull } from "drizzle-orm";
import { events, eventHosts, eventSponsors, registrationFields, ticketTypes, tags, eventTags, organizations } from "@ot/db";
import { db } from "@/lib/db";

export async function getPublicEventBySlug(slug: string) {
  const [event] = await db.select().from(events).where(and(eq(events.slug, slug), isNull(events.deletedAt))).limit(1);
  if (!event) return null;
  const [org] = await db.select().from(organizations).where(eq(organizations.id, event.organizationId)).limit(1);
  const [hosts, sponsors, types, fields, eventTagRows] = await Promise.all([
    db.select().from(eventHosts).where(eq(eventHosts.eventId, event.id)).orderBy(asc(eventHosts.position)),
    db.select().from(eventSponsors).where(eq(eventSponsors.eventId, event.id)).orderBy(asc(eventSponsors.position)),
    db.select().from(ticketTypes).where(and(eq(ticketTypes.eventId, event.id), eq(ticketTypes.hidden, false))).orderBy(asc(ticketTypes.position)),
    db.select().from(registrationFields).where(eq(registrationFields.eventId, event.id)).orderBy(asc(registrationFields.position)),
    db.select({ name: tags.name, slug: tags.slug }).from(eventTags).innerJoin(tags, eq(eventTags.tagId, tags.id)).where(eq(eventTags.eventId, event.id)),
  ]);
  return { event, org: org!, hosts, sponsors, ticketTypes: types, fields, tags: eventTagRows };
}

export async function listDiscoverableEvents(opts: { city?: string; limit?: number } = {}) {
  const where = [eq(events.visibility, "public"), eq(events.status, "published"), isNull(events.deletedAt), gte(events.endsAt, new Date())];
  if (opts.city) where.push(eq(events.city, opts.city));
  return db
    .select({
      id: events.id, slug: events.slug, name: events.name, coverImageUrl: events.coverImageUrl, startsAt: events.startsAt,
      timezone: events.timezone, city: events.city, locationType: events.locationType, orgName: organizations.name,
    })
    .from(events)
    .innerJoin(organizations, eq(events.organizationId, organizations.id))
    .where(and(...where))
    .orderBy(asc(events.startsAt))
    .limit(opts.limit ?? 48);
}
