import Link from "next/link";
import { getEventStats, listTicketTypes } from "@ot/core/services";
import { can } from "@ot/core";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireEvent } from "@/lib/dashboard";
import { formatDateRange, formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/dashboard/confirm-button";
import { cancelEventAction, deleteEventAction, publishEventAction, unpublishEventAction } from "../../actions";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event, role } = await requireEvent(id);
  const [stats, types] = await Promise.all([getEventStats(db, id), listTicketTypes(db, id)]);
  const editable = can(role, "edit_events");
  const url = `${env.APP_URL}/e/${event.slug}`;
  const maxDay = Math.max(1, ...stats.byDay.map((d) => d.count));

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Registered" value={String(stats.registrations)} sub={stats.pending ? `${stats.pending} awaiting approval` : undefined} />
        <Stat label="Revenue" value={formatMoney(stats.revenue, stats.currency)} sub="after refunds" />
        <Stat label="Checked in" value={String(stats.checkedIn)} sub={stats.registrations ? `${Math.round((stats.checkedIn / stats.registrations) * 100)}%` : undefined} />
        <Stat label="Capacity" value={event.capacity ? `${stats.registrations} / ${event.capacity}` : "Unlimited"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Registrations by day</CardTitle></CardHeader>
            <CardContent>
              {stats.byDay.length === 0 ? <p className="text-sm text-muted-foreground">No registrations yet.</p> : (
                <div className="flex h-24 items-end gap-1">
                  {stats.byDay.map((d) => (
                    <div key={d.day} className="group relative flex-1 rounded-t bg-primary/80" style={{ height: `${(d.count / maxDay) * 100}%` }} title={`${d.day}: ${d.count}`} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Tickets</CardTitle></CardHeader>
            <CardContent>
              {types.length === 0 ? <p className="text-sm text-muted-foreground">No ticket types yet. <Link href={`/dashboard/events/${id}/tickets`} className="underline underline-offset-4">Add one</Link>, or publish and a free General admission ticket is created for you.</p> : (
                <ul className="divide-y text-sm">
                  {types.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-2">
                      <span>{t.name} <span className="text-muted-foreground">· {t.priceMinor === 0 ? "Free" : formatMoney(t.priceMinor, t.currency)}</span></span>
                      <span className="tabular-nums text-muted-foreground">{t.sold}{t.quantity != null ? ` / ${t.quantity}` : ""} sold{t.held ? `, ${t.held} held` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Event page</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{formatDateRange(event.startsAt, event.endsAt, event.timezone)}<br />{event.timezone}</p>
              <p className="break-all"><a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{url}</a></p>
              <p className="text-xs text-muted-foreground">{event.visibility === "public" ? "Public: listed on Discover and indexed." : event.visibility === "unlisted" ? "Unlisted: anyone with the link." : "Private: invite only."}</p>
            </CardContent>
          </Card>
          {editable && (
            <Card>
              <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2">
                {event.status === "draft" && <form action={publishEventAction.bind(null, id)}><Button type="submit" className="w-full">Publish</Button></form>}
                {event.status === "published" && <form action={unpublishEventAction.bind(null, id)}><Button type="submit" variant="outline" className="w-full">Unpublish (back to draft)</Button></form>}
                {event.status !== "cancelled" && (
                  <ConfirmButton action={cancelEventAction.bind(null, id)} variant="outline" className="w-full" confirm="Cancel this event? Every registered attendee gets a cancellation email (and SMS if opted in). Paid orders still need refunding from the Orders tab.">
                    Cancel event
                  </ConfirmButton>
                )}
                {event.status !== "published" && (
                  <ConfirmButton action={deleteEventAction.bind(null, id)} variant="ghost" className="w-full text-destructive" confirm="Delete this event? It disappears from the dashboard. Attendee records are kept.">
                    Delete
                  </ConfirmButton>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-2xl" style={{ fontVariationSettings: '"opsz" 32' }}>{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
