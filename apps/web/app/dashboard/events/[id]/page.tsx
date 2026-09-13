import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BarChart3, Ticket } from "lucide-react";
import { getEventStats, listTicketTypes } from "@evnelo/core/services";
import { can } from "@evnelo/core";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireEvent } from "@/lib/dashboard";
import { formatDateRange, formatMoney } from "@/lib/utils";
import { publicEventPath } from "@/lib/urls";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmButton } from "@/components/dashboard/confirm-button";
import { EmptyCell, StatCard } from "@/components/dashboard/page-chrome";
import { RegistrationsChart } from "@/components/dashboard/registrations-chart";
import { cancelEventAction, deleteEventAction, publishEventAction, unpublishEventAction } from "../../actions";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event, role, org } = await requireEvent(id);
  const [stats, types, t, tc, locale] = await Promise.all([getEventStats(db, id), listTicketTypes(db, id), getTranslations("dashboard"), getTranslations("common"), getLocale()]);
  const editable = can(role, "edit_events");
  const url = `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`;
  const cards = [
    { label: t("event.overview.stats.registered"), value: String(stats.registrations), sub: stats.pending ? t("event.overview.stats.awaitingApproval", { count: stats.pending }) : t("event.overview.stats.confirmedAndApproved") },
    { label: t("event.overview.stats.revenue"), value: formatMoney(stats.revenue, stats.currency, locale), sub: t("event.overview.stats.afterRefunds") },
    { label: t("event.overview.stats.checkedIn"), value: String(stats.checkedIn), sub: stats.registrations ? t("event.overview.stats.percentOfRegistrations", { percent: Math.round((stats.checkedIn / stats.registrations) * 100) }) : t("event.overview.stats.nobodyYet") },
    { label: t("event.overview.stats.capacity"), value: event.capacity ? `${stats.registrations}/${event.capacity}` : "∞", sub: event.capacity ? t("event.overview.stats.seatsLeft", { count: Math.max(event.capacity - stats.registrations, 0) }) : t("event.overview.stats.unlimitedSeats") },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <div key={c.label} className="animate-rise" style={{ ["--stagger" as string]: i }}>
            <StatCard {...c} />
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-5">
          <Card className="p-5">
            <p className="eyebrow">{t("event.overview.registrationsByDay")}</p>
            <div className="mt-4">
              {stats.byDay.length === 0
                ? <EmptyCell icon={BarChart3} title={t("event.overview.noRegistrations.title")} description={t("event.overview.noRegistrations.description")} />
                : <RegistrationsChart data={stats.byDay} />}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="eyebrow">{t("event.overview.tickets")}</p>
              {types.length > 0 && <Link href={`/dashboard/events/${id}/tickets`} className="press text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground">{t("event.overview.manage")}</Link>}
            </div>
            {types.length === 0 ? (
              <EmptyCell
                icon={Ticket}
                title={t("event.overview.noTickets.title")}
                description={t("event.overview.noTickets.description")}
                action={<Button asChild size="sm" variant="outline"><Link href={`/dashboard/events/${id}/tickets`}>{t("event.overview.noTickets.action")}</Link></Button>}
              />
            ) : (
              <ul className="mt-3">
                {types.map((ty, i) => (
                  <li key={ty.id} className={`flex items-baseline justify-between gap-4 py-2.5 text-sm ${i > 0 ? "hairline" : ""}`}>
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{ty.name}</span>
                      <span className="ms-2 tabular-nums text-muted-foreground">{ty.priceMinor === 0 ? tc("labels.free") : formatMoney(ty.priceMinor, ty.currency, locale)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {t("event.overview.ticketSales", { sold: ty.sold, quantity: ty.quantity ?? 0, hasQuantity: ty.quantity != null ? "true" : "false", held: ty.held ?? 0 })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="eyebrow">{t("event.overview.eventPage")}</p>
            <p className="mt-3 text-sm">{formatDateRange(event.startsAt, event.endsAt, event.timezone, locale)}</p>
            <p className="text-xs text-muted-foreground">{event.timezone}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="press mt-3 block break-all text-sm underline decoration-dotted underline-offset-4 hover:text-foreground">{url}</a>
            <p className="hairline mt-3 pt-3 text-xs leading-relaxed text-muted-foreground">
              {t(`event.overview.visibility.${event.visibility}`)}
            </p>
          </Card>

          {editable && (
            <Card className="p-5">
              <p className="eyebrow">{t("event.overview.actions")}</p>
              <div className="mt-3 flex flex-col gap-2">
                {event.status === "draft" && (
                  <form action={publishEventAction.bind(null, id)}>
                    <SubmitButton className="w-full">{t("event.overview.publish")}</SubmitButton>
                  </form>
                )}
                {event.status === "published" && (
                  <form action={unpublishEventAction.bind(null, id)}>
                    <SubmitButton variant="outline" className="w-full">{t("event.overview.unpublish")}</SubmitButton>
                  </form>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {event.status === "draft" ? t("event.overview.statusNote.draft") : event.status === "published" ? t("event.overview.statusNote.published") : t("event.overview.statusNote.cancelled")}
                </p>
              </div>
              {/* a status is never both cancelled and published, so one of the two is always offered */}
              <div className="hairline mt-4 flex flex-col gap-2 pt-4">
                <p className="eyebrow text-destructive">{t("event.overview.irreversible")}</p>
                {event.status !== "cancelled" && (
                  <ConfirmButton action={cancelEventAction.bind(null, id)} variant="outline" className="w-full text-destructive hover:bg-destructive/5" confirm={t("event.overview.cancelConfirm")}>
                    {t("event.overview.cancelEvent")}
                  </ConfirmButton>
                )}
                {event.status !== "published" && (
                  <ConfirmButton action={deleteEventAction.bind(null, id)} variant="ghost" className="w-full text-destructive hover:bg-destructive/5" confirm={t("event.overview.deleteConfirm")}>
                    {t("event.overview.deleteEvent")}
                  </ConfirmButton>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
