import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { and, eq, isNull } from "drizzle-orm";
import { ArrowUpRight, CalendarPlus, Video } from "lucide-react";
import { attendees, events, organizations, tickets } from "@evnelo/db";
import { db } from "@/lib/db";
import { appleWalletConfigured, googleWalletConfigured } from "@/lib/env";
import { cn, formatDateRange } from "@/lib/utils";
import { publicEventPath } from "@/lib/urls";
import { calendarPath } from "@/lib/calendar";
import { buttonVariants } from "@/components/ui/button";
import { EVENTS } from "@/lib/analytics-events";
import { Track } from "@/components/analytics";

export const metadata = { robots: "noindex,nofollow" };

const pill = cn(buttonVariants({ variant: "outline", size: "pill" }), "h-11 px-5");

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
  const [t, locale] = await Promise.all([getTranslations("event"), getLocale()]);
  const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone: event.timezone }).format(event.startsAt);
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: event.timezone }).format(event.startsAt);
  // QR encodes the ticket URL (rendered by /t/{token}/qr); the scanner verifies the token server-side
  const qr = `/t/${token}/qr`;
  const status = t(`ticket.status.${attendee.status}`);
  const canJoinOnline = event.locationType !== "in_person" && event.onlineUrl && attendee.status === "confirmed" && event.status !== "cancelled";
  const cancelled = event.status === "cancelled";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      {cancelled && (
        <p role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{t("ticket.cancelled")}</p>
      )}
      <Track event={EVENTS.ticketViewed} properties={{ eventId: event.id, status: attendee.status, cancelled }} />
      <p className="print-hide eyebrow mb-5 text-center">{t("ticket.eyebrow")}</p>

      <div className={cn("ticket animate-rise grid sm:grid-cols-[minmax(0,1fr)_16rem]", cancelled && "opacity-80 grayscale")}>
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="date-leaf shrink-0 border-[color:var(--ticket-perforation)]" style={{ ["--accent-event" as string]: "var(--ticket-ink)", ["--accent-event-foreground" as string]: "var(--ticket-paper)" }}>
              <span>{month}</span><span>{day}</span>
            </div>
            <div className="min-w-0">
              <h1 className="display text-3xl sm:text-4xl">{event.name}</h1>
              <p className="mt-2 text-sm opacity-80">{formatDateRange(event.startsAt, event.endsAt, event.timezone, locale)}</p>
              {event.venueName && <p className="text-sm opacity-80">{event.venueName}{event.city ? `, ${event.city}` : ""}</p>}
              {event.locationType === "online" && <p className="text-sm opacity-80">{t("ticket.online")}</p>}
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] opacity-60">{t("ticket.admit")}</dt>
              <dd className="mt-1 font-display text-xl">{attendee.name}</dd>
              {host && <dd className="text-xs opacity-60">{t("ticket.guestOf", { name: host.name })}</dd>}
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] opacity-60">{t("ticket.statusLabel")}</dt>
              <dd className="mt-1 font-medium capitalize">{status}</dd>
            </div>
          </dl>
        </div>

        <div className="ticket-stub relative flex items-center justify-center gap-5 p-6 sm:flex-col sm:py-8 sm:pl-9">
          <span aria-hidden className="stub-label absolute left-3 top-1/2 hidden -translate-y-1/2 sm:block">{t("ticket.admitOne")}</span>
          <span aria-hidden className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-55 sm:hidden [writing-mode:vertical-rl] rotate-180">{t("ticket.admitOne")}</span>
          <img src={qr} alt={t("ticket.qrAlt")} width={220} height={220} className="size-40 rounded-lg bg-white p-2 shadow-[0_1px_0_rgb(0_0_0/0.06)] sm:size-[200px]" />
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.12em] opacity-60 sm:block">{t("ticket.scanAtDoor")}</span>
        </div>
      </div>

      <div className="print-hide mt-7 flex flex-wrap items-center justify-center gap-2.5">
        {canJoinOnline && (
          <a href={event.onlineUrl!} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ size: "pill" }), "h-11 bg-[var(--ticket-ink)] px-5 text-[var(--ticket-paper)] hover:bg-[var(--ticket-ink)]/90")}>
            <Video /> {t("ticket.joinOnline")}
          </a>
        )}
        <a href={calendarPath(row.organizationSlug, event.slug)} className={pill}><CalendarPlus /> {t("ticket.addToCalendar")}</a>
        <a href={publicEventPath(row.organizationSlug, event.slug)} className={pill}>{t("ticket.eventPage")} <ArrowUpRight className="rtl:-scale-x-100" /></a>
        {appleWalletConfigured && (
          <a href={`/t/${token}/wallet/apple`} className={cn(buttonVariants({ size: "pill" }), "h-11 bg-black px-5 text-white hover:bg-black/85")}>{t("ticket.appleWallet")}</a>
        )}
        {googleWalletConfigured && (
          <a href={`/t/${token}/wallet/google`} className={cn(buttonVariants({ variant: "outline", size: "pill" }), "h-11 border-black/80 bg-white px-5 text-black hover:bg-neutral-100")}>{t("ticket.googleWallet")}</a>
        )}
      </div>

      <p className="print-hide mx-auto mt-6 max-w-md text-center text-sm text-muted-foreground">
        {t("ticket.doorHint")}
      </p>
    </div>
  );
}
