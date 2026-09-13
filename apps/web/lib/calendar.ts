import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import type { Event, Organization } from "@evnelo/db";
import { env } from "@/lib/env";
import { buildIcs } from "@/lib/ics";
import { publicEventPath } from "@/lib/urls";

export const calendarPath = (organizationSlug: string, eventSlug: string) => `/api/calendar/${organizationSlug}/${eventSlug}.ics`;

/** ICS for a published, non-private event. Public info only: the online link stays behind the ticket. */
export async function calendarResponse(row: { event: Event; org: Organization } | null) {
  const [t, tc] = await Promise.all([getTranslations("event"), getTranslations("common")]);
  if (!row || row.event.status !== "published" || row.event.visibility === "private") return new NextResponse(tc("errors.notFound"), { status: 404 });
  const { event, org } = row;
  const url = `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`;
  const location = event.locationType === "online" ? t("calendar.online") : [event.venueName, event.address, event.city].filter(Boolean).join(", ") || null;
  const ics = buildIcs({
    uid: `${event.id}@evnelo`, start: event.startsAt, end: event.endsAt, summary: event.name,
    description: [event.descriptionMd, url].filter(Boolean).join("\n\n"), location, url,
  });
  return new NextResponse(ics, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${event.slug}.ics"`, "cache-control": "public, max-age=300" },
  });
}
