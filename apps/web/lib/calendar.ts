import { NextResponse } from "next/server";
import type { Event, Organization } from "@ot/db";
import { env } from "@/lib/env";
import { buildIcs } from "@/lib/ics";
import { publicEventPath } from "@/lib/urls";

export const calendarPath = (organizationSlug: string, eventSlug: string) => `/api/calendar/${organizationSlug}/${eventSlug}.ics`;

/** ICS for a published, non-private event. Public info only: the online link stays behind the ticket. */
export function calendarResponse(row: { event: Event; org: Organization } | null) {
  if (!row || row.event.status !== "published" || row.event.visibility === "private") return new NextResponse("not found", { status: 404 });
  const { event, org } = row;
  const url = `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`;
  const location = event.locationType === "online" ? "Online" : [event.venueName, event.address, event.city].filter(Boolean).join(", ") || null;
  const ics = buildIcs({
    uid: `${event.id}@openticket`, start: event.startsAt, end: event.endsAt, summary: event.name,
    description: [event.descriptionMd, url].filter(Boolean).join("\n\n"), location, url,
  });
  return new NextResponse(ics, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${event.slug}.ics"`, "cache-control": "public, max-age=300" },
  });
}
