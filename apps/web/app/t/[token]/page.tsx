import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { attendees, events, tickets } from "@ot/db";
import { db } from "@/lib/db";
import { formatDateRange } from "@/lib/utils";

export const metadata = { robots: "noindex,nofollow" };

export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db
    .select({ ticket: tickets, attendee: attendees, event: events })
    .from(tickets)
    .innerJoin(attendees, eq(tickets.attendeeId, attendees.id))
    .innerJoin(events, eq(tickets.eventId, events.id))
    .where(and(eq(tickets.token, token), isNull(tickets.revokedAt)))
    .limit(1);
  if (!row) notFound();
  const { attendee, event } = row;
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: event.timezone }).format(event.startsAt);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: event.timezone }).format(event.startsAt);
  // QR encodes the ticket URL (rendered by /t/{token}/qr); the scanner verifies the token server-side
  const qr = `/t/${token}/qr`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="ticket grid sm:grid-cols-[1fr_15rem]">
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="date-leaf" style={{ ["--accent-event" as string]: "var(--ticket-ink)", ["--accent-event-foreground" as string]: "var(--ticket-paper)" }}>
              <span>{month}</span><span>{day}</span>
            </div>
            <div>
              <h1 className="display text-3xl">{event.name}</h1>
              <p className="mt-2 text-sm opacity-80">{formatDateRange(event.startsAt, event.endsAt, event.timezone)}</p>
              {event.venueName && <p className="text-sm opacity-80">{event.venueName}</p>}
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="opacity-60">Admit</dt><dd className="font-medium">{attendee.name}</dd></div>
            <div><dt className="opacity-60">Status</dt><dd className="font-medium">{attendee.status === "confirmed" ? "Confirmed" : attendee.status.replace("_", " ")}</dd></div>
          </dl>
        </div>
        <div className="ticket-perforation flex flex-col items-center justify-center gap-3 p-6">
          <img src={qr} alt="Ticket QR code" width={220} height={220} className="size-[220px] rounded-md bg-white p-2" />
          <span className="text-xs opacity-60">Show this at the door</span>
        </div>
      </div>
      <div className="mt-6 flex gap-4 text-sm">
        <a href={`/api/calendar/${event.slug}.ics`} className="underline underline-offset-4">Add to calendar</a>
        <a href={`/e/${event.slug}`} className="underline underline-offset-4">Event page</a>
      </div>
    </div>
  );
}
