import { cache } from "react";
import { and, asc, eq } from "drizzle-orm";
import { events, eventHosts, eventSponsors, registrationFields, ticketTypes, tags, eventTags, organizations } from "@evnelo/db";
import {
  findEventForLegacySlug, getEventByOrgAndSlug, listPublicCities, listPublicEvents, listPublicTags, type PublicEventSearch,
} from "@evnelo/core/services";
import { db } from "@/lib/db";

/** Everything the public event page needs, by the canonical (organization slug, event slug) pair. */
export const getPublicEvent = cache(async function getPublicEvent(organizationSlug: string, eventSlug: string) {
  const row = await getEventByOrgAndSlug(db, organizationSlug, eventSlug);
  if (!row) return null;
  return loadEventRelations(row.event, row.org);
});

/** Legacy /e/{slug} links: resolve to the oldest matching event. */
export const getPublicEventByLegacySlug = cache(async function getPublicEventByLegacySlug(eventSlug: string) {
  const row = await findEventForLegacySlug(db, eventSlug);
  if (!row) return null;
  return loadEventRelations(row.event, row.org);
});

async function loadEventRelations(event: typeof events.$inferSelect, org: typeof organizations.$inferSelect) {
  const [hosts, sponsors, types, fields, eventTagRows] = await Promise.all([
    db.select().from(eventHosts).where(eq(eventHosts.eventId, event.id)).orderBy(asc(eventHosts.position)),
    db.select().from(eventSponsors).where(eq(eventSponsors.eventId, event.id)).orderBy(asc(eventSponsors.position)),
    db.select().from(ticketTypes).where(and(eq(ticketTypes.eventId, event.id), eq(ticketTypes.hidden, false))).orderBy(asc(ticketTypes.position)),
    db.select().from(registrationFields).where(eq(registrationFields.eventId, event.id)).orderBy(asc(registrationFields.position)),
    db.select({ name: tags.name, slug: tags.slug }).from(eventTags).innerJoin(tags, eq(eventTags.tagId, tags.id)).where(eq(eventTags.eventId, event.id)),
  ]);
  return { event, org, hosts, sponsors, ticketTypes: types, fields, tags: eventTagRows };
}

export function listDiscoverableEvents(opts: PublicEventSearch = {}) {
  return listPublicEvents(db, opts);
}

export function listDiscoverableTags(limit?: number) {
  return listPublicTags(db, limit);
}

export function listDiscoverableCities(limit?: number) {
  return listPublicCities(db, limit);
}
