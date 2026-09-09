import { and, asc, eq, isNull } from "drizzle-orm";
import { events, eventHosts, eventSponsors, registrationFields, ticketTypes, tags, eventTags, organizations } from "@ot/db";
import { listPublicEvents } from "@ot/core/services";
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

export function listDiscoverableEvents(opts: { city?: string; limit?: number } = {}) {
  return listPublicEvents(db, opts);
}
