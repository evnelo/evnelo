import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { ArrowUpRight, CalendarPlus } from "lucide-react";
import { attendees, discountCodes, events, orderItems, orders, organizations, ticketTypes, tickets } from "@evnelo/db";
import { db } from "@/lib/db";
import { appleWalletConfigured, googleWalletConfigured } from "@/lib/env";
import { cn, formatDateRange, formatMoney } from "@/lib/utils";
import { publicEventPath } from "@/lib/urls";
import { calendarPath } from "@/lib/calendar";
import { paymentMethodName } from "@/lib/payment-flow";
import { buttonVariants } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";

export const metadata = { robots: "noindex,nofollow" };

const pill = cn(buttonVariants({ variant: "outline", size: "pill" }), "h-11 px-5");

/**
 * The buyer's page after checkout: every ticket in the order with its QR code, and the receipt.
 * Reached from the success step, the confirmation email, or the link on the event card. The
 * token is the order's access token; each ticket still has its own /t/{token} for the door.
 */
export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db
    .select({ order: orders, event: events, org: organizations })
    .from(orders)
    .innerJoin(events, eq(orders.eventId, events.id))
    .innerJoin(organizations, eq(events.organizationId, organizations.id))
    .where(eq(orders.accessToken, token))
    .limit(1);
  if (!row) notFound();
  const { order, event, org } = row;
  const [t, locale] = await Promise.all([getTranslations("event"), getLocale()]);

  const party = await db
    .select({ attendee: attendees, ticket: tickets, ticketTypeName: ticketTypes.name })
    .from(attendees)
    .innerJoin(ticketTypes, eq(attendees.ticketTypeId, ticketTypes.id))
    .leftJoin(tickets, and(eq(tickets.attendeeId, attendees.id), isNull(tickets.revokedAt)))
    .where(and(eq(attendees.orderId, order.id), isNull(attendees.deletedAt)))
    .orderBy(asc(attendees.id));
  const hostNames = new Map(party.filter((p) => !p.attendee.guestOfAttendeeId).map((p) => [p.attendee.id, p.attendee.name]));
  const live = party.filter((p) => p.ticket);
  const awaitingApproval = party.some((p) => p.attendee.status === "pending_approval");
  const settled = order.status === "paid" || order.status === "free" || order.status === "partially_refunded";
  const refunded = order.status === "refunded";

  const items = settled || refunded
    ? await db.select({ quantity: orderItems.quantity, unitPriceMinor: orderItems.unitPriceMinor, name: ticketTypes.name })
        .from(orderItems).innerJoin(ticketTypes, eq(orderItems.ticketTypeId, ticketTypes.id)).where(eq(orderItems.orderId, order.id))
    : [];
  const [code] = order.discountCodeId
    ? await db.select({ code: discountCodes.code }).from(discountCodes).where(eq(discountCodes.id, order.discountCodeId)).limit(1)
    : [];
  const money = (minor: number) => formatMoney(minor, order.currency, locale);
  const method = paymentMethodName(order);
  const paidWith = method ? ("last4" in method ? t("order.cardEnding", { brand: method.brand, last4: method.last4 }) : method.method) : null;
  const paidOn = order.paidAt ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short", timeZone: event.timezone }).format(order.paidAt) : null;
  const receipt = order.totalMinor > 0 && (settled || refunded);
  const first = live[0]?.ticket;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <p className="print-hide eyebrow mb-3 text-center">{t("order.eyebrow")}</p>
      <h1 className="display text-center text-4xl sm:text-5xl">{awaitingApproval && !live.length ? t("order.titleApproval") : t("order.title")}</h1>
      <p className="mx-auto mt-3 max-w-md text-center text-muted-foreground">
        {awaitingApproval && !live.length
          ? t("order.introApproval")
          : refunded ? t("order.refundedNotice")
          : !settled ? t("order.notCompleted")
          : t.rich("order.intro", { count: live.length, eventName: event.name, link: (chunks) => <a className="underline underline-offset-4" href={publicEventPath(org.slug, event.slug)}>{chunks}</a> })}
      </p>

      <section className="mt-8 rounded-2xl border border-border/80 bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-start gap-4">
          <div className="date-leaf shrink-0">
            <span>{new Intl.DateTimeFormat(locale, { month: "short", timeZone: event.timezone }).format(event.startsAt)}</span>
            <span>{new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: event.timezone }).format(event.startsAt)}</span>
          </div>
          <div className="min-w-0">
            <h2 className="display text-2xl">{event.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{formatDateRange(event.startsAt, event.endsAt, event.timezone, locale)}</p>
            {event.venueName && <p className="text-sm text-muted-foreground">{event.venueName}{event.city ? `, ${event.city}` : ""}</p>}
            {event.locationType === "online" && <p className="text-sm text-muted-foreground">{t("ticket.online")}</p>}
          </div>
        </div>
      </section>

      {live.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-3">{t("order.tickets")}</h2>
          <ul className="space-y-3">
            {live.map(({ attendee, ticket, ticketTypeName }, i) => (
              <li key={ticket!.id} className="animate-rise flex items-center gap-4 rounded-2xl bg-[var(--ticket-paper)] p-4 text-[var(--ticket-ink)] sm:gap-5 sm:p-5" style={{ ["--stagger" as string]: i }}>
                <img src={`/t/${ticket!.token}/qr`} alt={t("ticket.qrAlt")} width={96} height={96} className="size-24 shrink-0 rounded-lg bg-white p-1.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] opacity-60">{ticketTypeName}</p>
                  <p className="display mt-1 truncate text-xl">{attendee.name}</p>
                  {attendee.guestOfAttendeeId && <p className="mt-0.5 text-xs opacity-60">{t("order.guestOf", { name: hostNames.get(attendee.guestOfAttendeeId) ?? "" })}</p>}
                  <p className="mt-1 text-xs capitalize opacity-70">{t(`ticket.status.${attendee.status}`)}</p>
                </div>
                <a href={`/t/${ticket!.token}`} className={cn(buttonVariants({ variant: "outline", size: "pill" }), "print-hide h-10 shrink-0 border-[var(--ticket-ink)]/30 bg-transparent px-4 text-[var(--ticket-ink)] hover:bg-[var(--ticket-ink)]/10")}>
                  {t("order.openTicket")} <ArrowUpRight className="rtl:-scale-x-100" />
                </a>
              </li>
            ))}
          </ul>
          <div className="print-hide mt-5 flex flex-wrap items-center gap-2.5">
            <a href={calendarPath(org.slug, event.slug)} className={pill}><CalendarPlus /> {t("order.addToCalendar")}</a>
            {first && appleWalletConfigured && (
              <a href={`/t/${first.token}/wallet/apple`} className={cn(buttonVariants({ size: "pill" }), "h-11 bg-black px-5 text-white hover:bg-black/85")}>{t("ticket.appleWallet")}</a>
            )}
            {first && googleWalletConfigured && (
              <a href={`/t/${first.token}/wallet/google`} className={cn(buttonVariants({ variant: "outline", size: "pill" }), "h-11 border-black/80 bg-white px-5 text-black hover:bg-neutral-100")}>{t("ticket.googleWallet")}</a>
            )}
            <a href={publicEventPath(org.slug, event.slug)} className={pill}>{t("order.eventPage")} <ArrowUpRight className="rtl:-scale-x-100" /></a>
          </div>
        </section>
      )}

      {receipt && (
        <section className="mt-8 rounded-2xl border border-border/80 bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="display text-2xl">{t("order.receipt")}</h2>
            <PrintButton size="sm" className="print-hide">{t("order.print")}</PrintButton>
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">{t("order.orderNumber")}</dt><dd className="mt-0.5 font-mono text-xs">{order.id}</dd></div>
            {paidOn && <div><dt className="text-muted-foreground">{t("order.paidOn")}</dt><dd className="mt-0.5">{paidOn}</dd></div>}
            {paidWith && <div><dt className="text-muted-foreground">{t("order.paidWith")}</dt><dd className="mt-0.5">{paidWith}</dd></div>}
          </dl>
          <table className="mt-5 w-full text-sm">
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-t border-border/70">
                  <td className="py-2.5">{t("order.lineItem", { count: item.quantity, name: item.name })}</td>
                  <td className="py-2.5 text-end tabular-nums">{money(item.unitPriceMinor * item.quantity)}</td>
                </tr>
              ))}
              {(order.discountMinor > 0 || order.taxMinor > 0 || order.serviceFeeMinor > 0) && (
                <tr className="border-t border-border/70 text-muted-foreground"><td className="py-2.5">{t("order.subtotal")}</td><td className="py-2.5 text-end tabular-nums">{money(order.subtotalMinor)}</td></tr>
              )}
              {order.discountMinor > 0 && <tr className="text-muted-foreground"><td className="py-1">{t("order.discount", { code: code?.code ?? "" })}</td><td className="py-1 text-end tabular-nums">−{money(order.discountMinor)}</td></tr>}
              {order.taxMinor > 0 && <tr className="text-muted-foreground"><td className="py-1">{t("order.tax")}</td><td className="py-1 text-end tabular-nums">{money(order.taxMinor)}</td></tr>}
              {order.serviceFeeMinor > 0 && <tr className="text-muted-foreground"><td className="py-1">{t("order.serviceFee")}</td><td className="py-1 text-end tabular-nums">{money(order.serviceFeeMinor)}</td></tr>}
              <tr className="border-t border-border font-semibold"><td className="py-3">{t("order.total")}</td><td className="py-3 text-end font-display text-lg tabular-nums">{money(order.totalMinor)}</td></tr>
              {order.refundedMinor > 0 && <tr className="text-muted-foreground"><td className="py-1">{t("order.refunded")}</td><td className="py-1 text-end tabular-nums">−{money(order.refundedMinor)}</td></tr>}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted-foreground">
            {org.name}
            {order.stripeReceiptUrl && <> · <a className="print-hide underline underline-offset-4" href={order.stripeReceiptUrl} target="_blank" rel="noopener noreferrer">{t("order.stripeReceipt")}</a></>}
          </p>
        </section>
      )}

      <p className="print-hide mt-6 text-center text-sm text-muted-foreground">{t("order.emailed", { email: order.email })}</p>
    </div>
  );
}
