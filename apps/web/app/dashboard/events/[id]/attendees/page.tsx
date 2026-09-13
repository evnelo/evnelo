import { getLocale, getTranslations } from "next-intl/server";
import { Download, Search, Users } from "lucide-react";
import { countAttendeesByStatus, listAttendees, listRegistrationFields } from "@evnelo/core/services";
import { can, registrationFileDownloadPath } from "@evnelo/core";
import type { Attendee } from "@evnelo/db";
import { db } from "@/lib/db";
import { requireEvent, statusVariant } from "@/lib/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
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
  const [rows, counts, fields, t, tc, locale] = await Promise.all([listAttendees(db, id, { q, status: st }), countAttendeesByStatus(db, id), listRegistrationFields(db, id), getTranslations("dashboard"), getTranslations("common"), getLocale()]);
  // file answers hold a private object key; this link is the only way to read one
  const fileFields = fields.filter((f) => f.type === "file" && f.scope !== "order");
  const showFiles = manage && fileFields.length > 0;
  const columns = 5 + (showFiles ? 1 : 0) + (manage ? 1 : 0);
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
  const attendeeStatus = (s: Attendee["status"]) => t(`status.attendee.${s}`);

  return (
    <div className="space-y-4">
      <form>
        <Toolbar
          actions={
            <Button asChild variant="outline">
              <a href={`/dashboard/events/${id}/attendees/export`}><Download className="size-4" /> {t("event.attendees.exportCsv")}</a>
            </Button>
          }
        >
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={q} placeholder={t("event.attendees.searchPlaceholder")} aria-label={tc("actions.search")} className="ps-9" />
          </div>
          <div className="w-48">
            <Select name="status" defaultValue={st} aria-label={tc("labels.status")} className="h-10">
              {statuses.map((s) => <option key={s} value={s}>{s === "all" ? t("event.attendees.allOption", { count: Object.values(counts).reduce((a, b) => a + (b ?? 0), 0) }) : t("event.attendees.statusOption", { label: attendeeStatus(s), count: counts[s] ?? 0 })}</option>)}
            </Select>
          </div>
          <Button type="submit" variant="secondary">{t("event.attendees.filter")}</Button>
        </Toolbar>
      </form>

      {counts.pending_approval && manage ? (
        <Note tone="warning" className="flex flex-wrap items-center justify-between gap-3">
          <span>{t("event.attendees.pendingNote", { count: counts.pending_approval })}</span>
          {st !== "pending_approval" && <a href={`?status=pending_approval`} className="press shrink-0 font-medium underline underline-offset-4">{t("event.attendees.review")}</a>}
        </Note>
      ) : null}

      <Table>
        <THead className="[&_th]:uppercase [&_th]:tracking-[0.12em]"><TR><TH>{tc("labels.name")}</TH><TH>{tc("labels.email")}</TH><TH>{t("event.attendees.columns.ticket")}</TH><TH>{tc("labels.status")}</TH><TH>{t("event.attendees.columns.registered")}</TH>{showFiles && <TH>{t("event.attendees.columns.files")}</TH>}{manage && <TH className="text-end">{t("event.attendees.columns.actions")}</TH>}</TR></THead>
        <TBody>
          {rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={columns}>
                <EmptyCell icon={Users} title={q || st !== "all" ? t("event.attendees.empty.noMatch.title") : t("event.attendees.empty.none.title")} description={q || st !== "all" ? t("event.attendees.empty.noMatch.description") : t("event.attendees.empty.none.description")} />
              </TD>
            </TR>
          )}
          {rows.map(({ attendee: a, ticketTypeName, ticketToken, ticketRevokedAt, hostName, orderStatus }) => (
            <TR key={a.id}>
              <TD>
                <div className="font-medium">{a.name}</div>
                {hostName && <div className="text-xs text-muted-foreground">{t("event.attendees.guestOf", { name: hostName })}</div>}
              </TD>
              <TD className="text-muted-foreground">{a.email}{a.phone && <div className="text-xs">{a.phone}{a.smsOptIn ? ` · ${t("event.attendees.sms")}` : ""}</div>}</TD>
              <TD>{ticketTypeName}<div className="text-xs text-muted-foreground">{orderStatus === "pending" ? t("event.attendees.paymentPending") : orderStatus ? t(`status.order.${orderStatus}`) : orderStatus}</div></TD>
              <TD><Badge variant={statusVariant[a.status]}>{attendeeStatus(a.status)}</Badge></TD>
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
                <TD className="text-end">
                  <div className="flex justify-end gap-1">
                    {a.status === "pending_approval" && (
                      <>
                        <form action={approveAttendeesAction.bind(null, id)}><input type="hidden" name="id" value={a.id} /><SubmitButton size="sm">{t("event.attendees.approve")}</SubmitButton></form>
                        <form action={rejectAttendeesAction.bind(null, id)}><input type="hidden" name="id" value={a.id} /><SubmitButton size="sm" variant="outline">{t("event.attendees.reject")}</SubmitButton></form>
                      </>
                    )}
                    {a.status === "confirmed" && (
                      <>
                        {ticketToken && !ticketRevokedAt && <Button asChild size="sm" variant="ghost"><a href={`/t/${ticketToken}`} target="_blank" rel="noopener noreferrer">{t("event.attendees.ticket")}</a></Button>}
                        <ConfirmButton action={cancelAttendeesAction.bind(null, id)} fields={{ id: a.id }} size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" confirm={t("event.attendees.cancelConfirm", { name: a.name })}>{tc("actions.cancel")}</ConfirmButton>
                      </>
                    )}
                    {!a.deletedAt && (
                      <>
                        <Button asChild size="sm" variant="ghost"><a href={`/dashboard/events/${id}/attendees/${a.id}/export`}>{t("event.attendees.export")}</a></Button>
                        <ConfirmButton action={eraseAttendeeAction.bind(null, id)} fields={{ id: a.id }} size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" confirm={t("event.attendees.eraseConfirm", { name: a.name })}>{t("event.attendees.erase")}</ConfirmButton>
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
