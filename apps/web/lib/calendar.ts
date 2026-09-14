import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import type { Event, Organization } from "@evnelo/db";
import { env } from "@/lib/env";
import { buildIcs } from "@/lib/ics";
import { orderPath, publicEventPath } from "@/lib/urls";

/** Public calendar file: event information only. */
export const calendarPath = (organizationSlug: string, eventSlug: string) => `/api/calendar/${organizationSlug}/${eventSlug}.ics`;
/** A ticket holder's calendar file: same event, plus a link back to the ticket (the QR cannot ride in a calendar). */
export const ticketCalendarPath = (ticketToken: string) => `/t/${ticketToken}/calendar.ics`;
/** The order's calendar file, linking to the order page with every ticket in the party. */
export const orderCalendarPath = (orderToken: string) => `${orderPath(orderToken)}/calendar.ics`;

type Holder = {
  /** Where the calendar entry sends the holder: the ticket or order page. Goes first in the description and in URL. */
  link: string;
  /** "Your ticket" / "Your tickets", already translated. */
  label: string;
  /** Join link for online events, only when the holder is confirmed. */
  onlineUrl?: string | null;
};

type Strings = { online: string };

/** The VEVENT input for an event, optionally personalised for a ticket holder. Pure, so it is testable. */
export function calendarEvent(event: Event, org: Organization, s: Strings, holder?: Holder) {
  const eventUrl = `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`;
  const location = event.locationType === "online" ? s.online : [event.venueName, event.address, event.city].filter(Boolean).join(", ") || null;
  const description = [
    holder ? `${holder.label}: ${holder.link}` : null,
    holder?.onlineUrl ?? null,
    event.descriptionMd,
    eventUrl,
  ].filter(Boolean).join("\n\n");
  return {
    uid: holder ? `${event.id}-${holder.link.split("/").pop()}@evnelo` : `${event.id}@evnelo`,
    start: event.startsAt, end: event.endsAt, summary: event.name,
    description, location, url: holder?.link ?? eventUrl,
  };
}

/** ICS for a published, non-private event. Public info only: the online link stays behind the ticket. */
export async function calendarResponse(row: { event: Event; org: Organization } | null) {
  const [t, tc] = await Promise.all([getTranslations("event"), getTranslations("common")]);
  if (!row || row.event.status !== "published" || row.event.visibility === "private") return new NextResponse(tc("errors.notFound"), { status: 404 });
  const { event, org } = row;
  return icsResponse(buildIcs(calendarEvent(event, org, { online: t("calendar.online") })), event.slug, "public, max-age=300");
}

/**
 * ICS for a ticket or order holder. Works for private events too (they hold a ticket), but not
 * once the event is cancelled. Never cached: the link inside is a bearer token.
 */
export async function holderCalendarResponse(row: { event: Event; org: Organization } | null, holder: Omit<Holder, "label"> & { kind: "ticket" | "order" }) {
  const [t, tc] = await Promise.all([getTranslations("event"), getTranslations("common")]);
  if (!row || row.event.status === "cancelled") return new NextResponse(tc("errors.notFound"), { status: 404 });
  const { event, org } = row;
  const label = t(holder.kind === "ticket" ? "calendar.ticket" : "calendar.order");
  return icsResponse(buildIcs(calendarEvent(event, org, { online: t("calendar.online") }, { ...holder, label })), event.slug, "private, no-store");
}

function icsResponse(ics: string, slug: string, cacheControl: string) {
  return new NextResponse(ics, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${slug}.ics"`, "cache-control": cacheControl, "x-robots-tag": "noindex" },
  });
}
