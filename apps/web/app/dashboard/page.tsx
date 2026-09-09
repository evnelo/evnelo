import Link from "next/link";
import { Plus } from "lucide-react";
import { listOrgEvents } from "@ot/core/services";
import { can } from "@ot/core";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth/session";
import { statusVariant } from "@/lib/dashboard";
import { formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function EventsPage() {
  const { org, role } = await requireOrg("view_events", "/dashboard");
  const rows = await listOrgEvents(db, org.id);
  const fmt = (d: Date, tz: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz }).format(d);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="display text-3xl">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">{org.name}</p>
        </div>
        {can(role, "edit_events") && <Button asChild><Link href="/dashboard/events/new"><Plus className="size-4" /> New event</Link></Button>}
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No events yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first event. It stays a draft until you publish it.</p>
          {can(role, "edit_events") && <Button asChild className="mt-4"><Link href="/dashboard/events/new">Create an event</Link></Button>}
        </div>
      ) : (
        <div className="mt-6">
          <Table>
            <THead><TR><TH>Event</TH><TH>When</TH><TH>Status</TH><TH className="text-right">Registered</TH><TH className="text-right">Revenue</TH><TH className="text-right">Checked in</TH></TR></THead>
            <TBody>
              {rows.map(({ event: e, registrations, pending, revenue, checkedIn }) => (
                <TR key={e.id}>
                  <TD><Link href={`/dashboard/events/${e.id}`} className="font-medium hover:underline underline-offset-4">{e.name}</Link><div className="text-xs text-muted-foreground">{e.locationType === "online" ? "Online" : e.city ?? e.venueName ?? "In person"}</div></TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{fmt(e.startsAt, e.timezone)}</TD>
                  <TD><Badge variant={statusVariant[e.status]}>{e.status}</Badge></TD>
                  <TD className="text-right tabular-nums">{registrations}{pending > 0 && <span className="ml-1 text-xs text-muted-foreground">+{pending} pending</span>}</TD>
                  <TD className="text-right tabular-nums">{revenue > 0 ? formatMoney(revenue, "USD") : <span className="text-muted-foreground">—</span>}</TD>
                  <TD className="text-right tabular-nums">{checkedIn}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
