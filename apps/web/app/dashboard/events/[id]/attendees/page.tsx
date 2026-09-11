import { Download, Search, Users } from "lucide-react";
import { countAttendeesByStatus, listAttendees, listRegistrationFields } from "@ot/core/services";
import { can, registrationFileDownloadPath } from "@ot/core";
import type { Attendee } from "@ot/db";
import { db } from "@/lib/db";
import { requireEvent, statusLabel, statusVariant } from "@/lib/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmButton } from "@/components/dashboard/confirm-button";
import { EmptyCell, Note, Toolbar } from "@/components/dashboard/page-chrome";
import { approveAttendeesAction, cancelAttendeesAction, eraseAttendeeAction, rejectAttendeesAction } from "../../../actions";

const statuses: (Attendee["status"] | "all")[] = ["all", "confirmed", "pending_approval", "waitlisted", "rejected", "cancelled"];

export default async function AttendeesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; status?: string }> }) {
  const { id } = await params;
  const { q = "", status = "all" } = await searchParams;
  const { role } = await requireEvent(id);
  const manage = can(role, "manage_attendees");
  const st = (statuses.includes(status as never) ? status : "all") as Attendee["status"] | "all";
  const [rows, counts, fields] = await Promise.all([listAttendees(db, id, { q, status: st }), countAttendeesByStatus(db, id), listRegistrationFields(db, id)]);
  // file answers hold a private object key; this link is the only way to read one
  const fileFields = fields.filter((f) => f.type === "file" && f.scope !== "order");
  const showFiles = manage && fileFields.length > 0;
  const columns = 5 + (showFiles ? 1 : 0) + (manage ? 1 : 0);
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);

  return (
    <div className="space-y-4">
      <form>
        <Toolbar
          actions={
            <Button asChild variant="outline">
              <a href={`/dashboard/events/${id}/attendees/export`}><Download className="size-4" /> Export CSV</a>
            </Button>
          }
        >
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={q} placeholder="Search name, email or phone" aria-label="Search" className="pl-9" />
          </div>
          <div className="w-48">
            <Select name="status" defaultValue={st} aria-label="Status" className="h-10">
              {statuses.map((s) => <option key={s} value={s}>{s === "all" ? `All (${Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)})` : `${statusLabel(s)} (${counts[s] ?? 0})`}</option>)}
            </Select>
          </div>
          <Button type="submit" variant="secondary">Filter</Button>
        </Toolbar>
      </form>

      {counts.pending_approval && manage ? (
        <Note tone="warning" className="flex flex-wrap items-center justify-between gap-3">
          <span>{counts.pending_approval} registration{counts.pending_approval === 1 ? "" : "s"} waiting for your approval.</span>
          {st !== "pending_approval" && <a href={`?status=pending_approval`} className="press shrink-0 font-medium underline underline-offset-4">Review</a>}
        </Note>
      ) : null}

      <Table>
        <THead className="[&_th]:uppercase [&_th]:tracking-[0.12em]"><TR><TH>Name</TH><TH>Email</TH><TH>Ticket</TH><TH>Status</TH><TH>Registered</TH>{showFiles && <TH>Files</TH>}{manage && <TH className="text-right">Actions</TH>}</TR></THead>
        <TBody>
          {rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={columns}>
                <EmptyCell icon={Users} title={q || st !== "all" ? "No attendees match" : "Nobody has registered yet"} description={q || st !== "all" ? "Try a different search or clear the status filter." : "Registrations land here the moment someone signs up."} />
              </TD>
            </TR>
          )}
          {rows.map(({ attendee: a, ticketTypeName, ticketToken, ticketRevokedAt, hostName, orderStatus }) => (
            <TR key={a.id}>
              <TD>
                <div className="font-medium">{a.name}</div>
                {hostName && <div className="text-xs text-muted-foreground">Guest of {hostName}</div>}
              </TD>
              <TD className="text-muted-foreground">{a.email}{a.phone && <div className="text-xs">{a.phone}{a.smsOptIn ? " · SMS" : ""}</div>}</TD>
              <TD>{ticketTypeName}<div className="text-xs text-muted-foreground">{orderStatus === "pending" ? "payment pending" : orderStatus}</div></TD>
              <TD><Badge variant={statusVariant[a.status]}>{statusLabel(a.status)}</Badge></TD>
              <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{fmt(a.createdAt)}</TD>
              {showFiles && (
                <TD className="space-y-1">
                  {fileFields.map((f) => {
                    const href = registrationFileDownloadPath(String(a.answers[f.key] ?? ""));
                    return href
                      ? <a key={f.key} href={href} className="block text-xs underline decoration-dotted underline-offset-4">{f.label}</a>
                      : <span key={f.key} className="block text-xs text-muted-foreground">—</span>;
                  })}
                </TD>
              )}
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
                        <ConfirmButton action={cancelAttendeesAction.bind(null, id)} fields={{ id: a.id }} size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" confirm={`Cancel ${a.name}'s registration? Their ticket stops working and the seat is freed. No email is sent.`}>Cancel</ConfirmButton>
                      </>
                    )}
                    {!a.deletedAt && (
                      <>
                        <Button asChild size="sm" variant="ghost"><a href={`/dashboard/events/${id}/attendees/${a.id}/export`}>Export</a></Button>
                        <ConfirmButton action={eraseAttendeeAction.bind(null, id)} fields={{ id: a.id }} size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" confirm={`Erase ${a.name}'s personal data? Name, email, phone and answers are replaced with placeholders, their ticket is revoked and queued emails are dropped. This cannot be undone.`}>Erase</ConfirmButton>
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
