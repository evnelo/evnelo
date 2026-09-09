import { countAttendeesByStatus, listAttendees } from "@ot/core/services";
import { can } from "@ot/core";
import type { Attendee } from "@ot/db";
import { db } from "@/lib/db";
import { requireEvent, statusLabel, statusVariant } from "@/lib/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmButton } from "@/components/dashboard/confirm-button";
import { approveAttendeesAction, cancelAttendeesAction, rejectAttendeesAction } from "../../../actions";

const statuses: (Attendee["status"] | "all")[] = ["all", "confirmed", "pending_approval", "waitlisted", "rejected", "cancelled"];

export default async function AttendeesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; status?: string }> }) {
  const { id } = await params;
  const { q = "", status = "all" } = await searchParams;
  const { role } = await requireEvent(id);
  const manage = can(role, "manage_attendees");
  const st = (statuses.includes(status as never) ? status : "all") as Attendee["status"] | "all";
  const [rows, counts] = await Promise.all([listAttendees(db, id, { q, status: st }), countAttendeesByStatus(db, id)]);
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1"><Input name="q" defaultValue={q} placeholder="Search name, email or phone" aria-label="Search" /></div>
        <div className="w-44">
          <Select name="status" defaultValue={st} aria-label="Status">
            {statuses.map((s) => <option key={s} value={s}>{s === "all" ? `All (${Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)})` : `${statusLabel(s)} (${counts[s] ?? 0})`}</option>)}
          </Select>
        </div>
        <Button type="submit" variant="outline">Filter</Button>
        <Button asChild variant="ghost"><a href={`/dashboard/events/${id}/attendees/export`}>Export CSV</a></Button>
      </form>

      {counts.pending_approval && manage ? (
        <div className="flex items-center justify-between rounded-md border border-[#e6d39a] bg-[#fbf1d6] px-3 py-2 text-sm">
          <span>{counts.pending_approval} registration{counts.pending_approval === 1 ? "" : "s"} waiting for your approval.</span>
          {st !== "pending_approval" && <a href={`?status=pending_approval`} className="underline underline-offset-4">Review</a>}
        </div>
      ) : null}

      <Table>
        <THead><TR><TH>Name</TH><TH>Email</TH><TH>Ticket</TH><TH>Status</TH><TH>Registered</TH>{manage && <TH className="text-right">Actions</TH>}</TR></THead>
        <TBody>
          {rows.length === 0 && <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">No attendees match.</TD></TR>}
          {rows.map(({ attendee: a, ticketTypeName, ticketToken, ticketRevokedAt, hostName, orderStatus }) => (
            <TR key={a.id}>
              <TD>
                <div className="font-medium">{a.name}</div>
                {hostName && <div className="text-xs text-muted-foreground">Guest of {hostName}</div>}
              </TD>
              <TD className="text-muted-foreground">{a.email}{a.phone && <div className="text-xs">{a.phone}{a.smsOptIn ? " · SMS" : ""}</div>}</TD>
              <TD>{ticketTypeName}<div className="text-xs text-muted-foreground">{orderStatus === "pending" ? "payment pending" : orderStatus}</div></TD>
              <TD><Badge variant={statusVariant[a.status]}>{statusLabel(a.status)}</Badge></TD>
              <TD className="whitespace-nowrap text-muted-foreground">{fmt(a.createdAt)}</TD>
              {manage && (
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {a.status === "pending_approval" && (
                      <>
                        <form action={approveAttendeesAction.bind(null, id)}><input type="hidden" name="id" value={a.id} /><Button size="sm" type="submit">Approve</Button></form>
                        <form action={rejectAttendeesAction.bind(null, id)}><input type="hidden" name="id" value={a.id} /><Button size="sm" variant="outline" type="submit">Reject</Button></form>
                      </>
                    )}
                    {a.status === "confirmed" && (
                      <>
                        {ticketToken && !ticketRevokedAt && <Button asChild size="sm" variant="ghost"><a href={`/t/${ticketToken}`} target="_blank" rel="noopener noreferrer">Ticket</a></Button>}
                        <ConfirmButton action={cancelAttendeesAction.bind(null, id)} fields={{ id: a.id }} size="sm" variant="ghost" confirm={`Cancel ${a.name}'s registration? Their ticket stops working and the seat is freed. No email is sent.`}>Cancel</ConfirmButton>
                      </>
                    )}
                  </div>
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
