import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { attendees, events, organizations, tickets } from "@ot/db";
import { db } from "@/lib/db";
import { appleWalletConfigured, googleWalletConfigured } from "@/lib/env";
import { formatDateRange } from "@/lib/utils";
import { publicEventPath } from "@/lib/urls";
import { calendarPath } from "@/lib/calendar";

export const metadata = { robots: "noindex,nofollow" };

export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db
    .select({ ticket: tickets, attendee: attendees, event: events, organizationSlug: organizations.slug })
    .from(tickets)
    .innerJoin(attendees, eq(tickets.attendeeId, attendees.id))
    .innerJoin(events, eq(tickets.eventId, events.id))
    .innerJoin(organizations, eq(events.organizationId, organizations.id))
    .where(and(eq(tickets.token, token), isNull(tickets.revokedAt)))
    .limit(1);
  if (!row) notFound();
  const { attendee, event } = row;
  const [host] = attendee.guestOfAttendeeId
    ? await db.select({ name: attendees.name }).from(attendees).where(eq(attendees.id, attendee.guestOfAttendeeId)).limit(1)
    : [];
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: event.timezone }).format(event.startsAt);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: event.timezone }).format(event.startsAt);
  // QR encodes the ticket URL (rendered by /t/{token}/qr); the scanner verifies the token server-side
  const qr = `/t/${token}/qr`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {event.status === "cancelled" && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">This event has been cancelled. This ticket is no longer valid.</p>
      )}
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
            <div>
              <dt className="opacity-60">Admit</dt>
              <dd className="font-medium">{attendee.name}</dd>
              {host && <dd className="text-xs opacity-60">Guest of {host.name}</dd>}
            </div>
            <div><dt className="opacity-60">Status</dt><dd className="font-medium">{attendee.status === "confirmed" ? "Confirmed" : attendee.status.replace("_", " ")}</dd></div>
          </dl>
        </div>
        <div className="ticket-perforation flex flex-col items-center justify-center gap-3 p-6">
          <img src={qr} alt="Ticket QR code" width={220} height={220} className="size-[220px] rounded-md bg-white p-2" />
          <span className="text-xs opacity-60">Show this at the door</span>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
        <a href={calendarPath(row.organizationSlug, event.slug)} className="underline underline-offset-4">Add to calendar</a>
        <a href={publicEventPath(row.organizationSlug, event.slug)} className="underline underline-offset-4">Event page</a>
        {(appleWalletConfigured || googleWalletConfigured) && (
          <span className="ml-auto flex gap-2">
            {appleWalletConfigured && (
              <a href={`/t/${token}/wallet/apple`} className="inline-flex h-9 items-center rounded-md bg-black px-3 text-xs font-medium text-white hover:bg-black/85">Add to Apple Wallet</a>
            )}
            {googleWalletConfigured && (
              <a href={`/t/${token}/wallet/google`} className="inline-flex h-9 items-center rounded-md border border-black/80 bg-white px-3 text-xs font-medium text-black hover:bg-neutral-100">Add to Google Wallet</a>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
