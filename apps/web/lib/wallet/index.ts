import { readFileSync } from "node:fs";
import { and, eq, isNull } from "drizzle-orm";
import { attendees, events, organizations, ticketTypes, tickets } from "@evnelo/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/** Everything a wallet pass needs, resolved once per request from the ticket token. */
export type TicketPassData = {
  ticketId: string;
  ticketUrl: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  locationType: "in_person" | "online" | "hybrid";
  venueName: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  attendeeName: string;
  ticketTypeName: string;
  orgName: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
};

export async function loadTicketPass(token: string): Promise<TicketPassData | null> {
  const [row] = await db
    .select({ ticket: tickets, attendee: attendees, event: events, org: organizations, ticketType: ticketTypes })
    .from(tickets)
    .innerJoin(attendees, eq(tickets.attendeeId, attendees.id))
    .innerJoin(events, eq(tickets.eventId, events.id))
    .innerJoin(organizations, eq(events.organizationId, organizations.id))
    .innerJoin(ticketTypes, eq(attendees.ticketTypeId, ticketTypes.id))
    .where(and(eq(tickets.token, token), isNull(tickets.revokedAt)))
    .limit(1);
  if (!row) return null;
  const { ticket, attendee, event, org, ticketType } = row;
  return {
    ticketId: ticket.id, ticketUrl: `${env.APP_URL}/t/${token}`,
    eventId: event.id, eventName: event.name, eventSlug: event.slug,
    startsAt: event.startsAt, endsAt: event.endsAt, timezone: event.timezone, locationType: event.locationType,
    venueName: event.venueName, address: event.address, city: event.city,
    lat: event.lat ? Number(event.lat) : null, lng: event.lng ? Number(event.lng) : null,
    attendeeName: attendee.name, ticketTypeName: ticketType.name,
    orgName: org.name, logoUrl: org.logoUrl, coverImageUrl: event.coverImageUrl,
  };
}

/**
 * A PEM/JSON secret from env, in whichever form fits the deployment: the inline contents
 * (with "\n" escapes allowed, so a one-line .env value works), the same contents base64-encoded
 * (the safest form for a Docker env file), or a path to a file holding them.
 */
export function secretFromEnv(value: string, inlineMarker: string) {
  const trimmed = value.trim();
  if (trimmed.includes(inlineMarker)) return trimmed.replace(/\\n/g, "\n");
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    if (decoded.includes(inlineMarker)) return decoded;
  }
  return readFileSync(trimmed, "utf8");
}

export function whereLabel(t: TicketPassData) {
  return t.locationType === "online" ? "Online" : [t.venueName, t.city].filter(Boolean).join(", ") || "See event page";
}
