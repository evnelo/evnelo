import type { MetadataRoute } from "next";
import { listIndexableEvents, listIndexableOrganizations } from "@ot/core/services";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { organizationPath, publicEventPath } from "@/lib/urls";

/** Built per request: the event list changes constantly and the build must not need a database. */
export const dynamic = "force-dynamic";

/**
 * Only what `isDiscoverable` allows: public, published, undeleted events and the organizations
 * behind them. Unlisted events are link-only and private events need an invite, so neither is
 * ever listed here — the queries filter them out in SQL rather than trusting a caller to.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [events, organizations] = await Promise.all([listIndexableEvents(db), listIndexableOrganizations(db)]);
  const now = new Date();

  return [
    { url: `${env.APP_URL}/discover`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    ...organizations.map((org) => ({
      url: `${env.APP_URL}${organizationPath(org.slug)}`,
      lastModified: org.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...events.map((event) => ({
      url: `${env.APP_URL}${publicEventPath(event.orgSlug, event.slug)}`,
      lastModified: event.updatedAt,
      // A future event's page still changes (tickets sell out); a finished one is settled.
      changeFrequency: event.endsAt > now ? ("daily" as const) : ("yearly" as const),
      priority: event.endsAt > now ? 0.8 : 0.3,
    })),
  ];
}
