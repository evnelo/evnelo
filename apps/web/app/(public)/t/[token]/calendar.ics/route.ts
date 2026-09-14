import { and, eq, isNull } from "drizzle-orm";
import { attendees, events, organizations, tickets } from "@evnelo/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { holderCalendarResponse } from "@/lib/calendar";

export const runtime = "nodejs";

/** GET /t/{token}/calendar.ics: the event with a link back to this ticket, since a QR cannot live in a calendar. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db
    .select({ event: events, org: organizations, status: attendees.status })
    .from(tickets)
    .innerJoin(attendees, eq(tickets.attendeeId, attendees.id))
    .innerJoin(events, eq(tickets.eventId, events.id))
    .innerJoin(organizations, eq(events.organizationId, organizations.id))
    .where(and(eq(tickets.token, token), isNull(tickets.revokedAt)))
    .limit(1);
  const onlineUrl = row && row.event.locationType !== "in_person" && row.status === "confirmed" ? row.event.onlineUrl : null;
  return holderCalendarResponse(row ?? null, { kind: "ticket", link: `${env.APP_URL}/t/${token}`, onlineUrl });
}
