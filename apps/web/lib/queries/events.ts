import { and, asc, eq, isNull } from "drizzle-orm";
import { events, eventHosts, eventSponsors, registrationFields, ticketTypes, tags, eventTags, organizations } from "@ot/db";
import { listPublicEvents } from "@ot/core/services";
import { db } from "@/lib/db";

export async function getPublicEventBySlug(slug: string, organizationSlug?: string) {
  const where = [eq(events.slug, slug), isNull(events.deletedAt)];
  if (organizationSlug) where.push(eq(organizations.slug, organizationSlug));
  const [row] = await db
    .select({ event: events, org: organizations })
    .from(events)
    .innerJoin(organizations, eq(events.organizationId, organizations.id))
    .where(and(...where))
    .limit(1);
  if (!row) return null;
  const { event, org } = row;
  const [hosts, sponsors, types, fields, eventTagRows] = await Promise.all([
    db.select().from(eventHosts).where(eq(eventHosts.eventId, event.id)).orderBy(asc(eventHosts.position)),
    db.select().from(eventSponsors).where(eq(eventSponsors.eventId, event.id)).orderBy(asc(eventSponsors.position)),
    db.select().from(ticketTypes).where(and(eq(ticketTypes.eventId, event.id), eq(ticketTypes.hidden, false))).orderBy(asc(ticketTypes.position)),
    db.select().from(registrationFields).where(eq(registrationFields.eventId, event.id)).orderBy(asc(registrationFields.position)),
    db.select({ name: tags.name, slug: tags.slug }).from(eventTags).innerJoin(tags, eq(eventTags.tagId, tags.id)).where(eq(eventTags.eventId, event.id)),
  ]);
  return { event, org: org!, hosts, sponsors, ticketTypes: types, fields, tags: eventTagRows };
}

export function listDiscoverableEvents(opts: { city?: string; limit?: number } = {}) {
  return listPublicEvents(db, opts);
}
