import Link from "next/link";
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
import { ConfirmButton } from "@/components/dashboard/confirm-button";
import { EmptyCell, StatCard } from "@/components/dashboard/page-chrome";
import { RegistrationsChart } from "@/components/dashboard/registrations-chart";
import { cancelEventAction, deleteEventAction, publishEventAction, unpublishEventAction } from "../../actions";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event, role, org } = await requireEvent(id);
  const [stats, types] = await Promise.all([getEventStats(db, id), listTicketTypes(db, id)]);
  const editable = can(role, "edit_events");
  const url = `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`;
  const cards = [
    { label: "Registered", value: String(stats.registrations), sub: stats.pending ? `${stats.pending} awaiting approval` : "confirmed and approved" },
    { label: "Revenue", value: formatMoney(stats.revenue, stats.currency), sub: "after refunds" },
    { label: "Checked in", value: String(stats.checkedIn), sub: stats.registrations ? `${Math.round((stats.checkedIn / stats.registrations) * 100)}% of registrations` : "nobody at the door yet" },
    { label: "Capacity", value: event.capacity ? `${stats.registrations}/${event.capacity}` : "∞", sub: event.capacity ? `${Math.max(event.capacity - stats.registrations, 0)} seats left` : "unlimited seats" },
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
            <p className="eyebrow">Registrations by day</p>
            <div className="mt-4">
              {stats.byDay.length === 0
                ? <EmptyCell icon={BarChart3} title="No registrations yet" description="The curve starts the moment your first person signs up." />
                : <RegistrationsChart data={stats.byDay} />}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="eyebrow">Tickets</p>
              {types.length > 0 && <Link href={`/dashboard/events/${id}/tickets`} className="press text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground">Manage</Link>}
            </div>
            {types.length === 0 ? (
              <EmptyCell
                icon={Ticket}
                title="No ticket types yet"
                description="Publishing without one creates a free General admission ticket for you."
                action={<Button asChild size="sm" variant="outline"><Link href={`/dashboard/events/${id}/tickets`}>Add a ticket type</Link></Button>}
              />
            ) : (
              <ul className="mt-3">
                {types.map((t, i) => (
                  <li key={t.id} className={`flex items-baseline justify-between gap-4 py-2.5 text-sm ${i > 0 ? "hairline" : ""}`}>
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{t.name}</span>
                      <span className="ml-2 tabular-nums text-muted-foreground">{t.priceMinor === 0 ? "Free" : formatMoney(t.priceMinor, t.currency)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {t.sold}{t.quantity != null ? ` / ${t.quantity}` : ""} sold{t.held ? `, ${t.held} held` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="eyebrow">Event page</p>
            <p className="mt-3 text-sm">{formatDateRange(event.startsAt, event.endsAt, event.timezone)}</p>
            <p className="text-xs text-muted-foreground">{event.timezone}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="press mt-3 block break-all text-sm underline decoration-dotted underline-offset-4 hover:text-foreground">{url}</a>
            <p className="hairline mt-3 pt-3 text-xs leading-relaxed text-muted-foreground">
              {event.visibility === "public" ? "Public: listed on Discover and indexed." : event.visibility === "unlisted" ? "Unlisted: anyone with the link." : "Private: invite only."}
            </p>
          </Card>

          {editable && (
            <Card className="p-5">
              <p className="eyebrow">Actions</p>
              <div className="mt-3 flex flex-col gap-2">
                {event.status === "draft" && (
                  <form action={publishEventAction.bind(null, id)}>
                    <Button type="submit" className="w-full">Publish event</Button>
                  </form>
                )}
                {event.status === "published" && (
                  <form action={unpublishEventAction.bind(null, id)}>
                    <Button type="submit" variant="outline" className="w-full">Unpublish, back to draft</Button>
                  </form>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {event.status === "draft" ? "Only you can see this event until it is published." : event.status === "published" ? "Live. Unpublishing hides the page; registrations already taken are kept." : "This event is cancelled."}
                </p>
              </div>
              {/* a status is never both cancelled and published, so one of the two is always offered */}
              <div className="hairline mt-4 flex flex-col gap-2 pt-4">
                <p className="eyebrow text-destructive">Irreversible</p>
                {event.status !== "cancelled" && (
                  <ConfirmButton action={cancelEventAction.bind(null, id)} variant="outline" className="w-full text-destructive hover:bg-destructive/5" confirm="Cancel this event? Every registered attendee gets a cancellation email (and SMS if opted in). Paid orders still need refunding from the Orders tab.">
                    Cancel event
                  </ConfirmButton>
                )}
                {event.status !== "published" && (
                  <ConfirmButton action={deleteEventAction.bind(null, id)} variant="ghost" className="w-full text-destructive hover:bg-destructive/5" confirm="Delete this event? It disappears from the dashboard. Attendee records are kept.">
                    Delete event
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
