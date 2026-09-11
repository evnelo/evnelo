"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FormMessage } from "@/components/ui/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";
import { promoteWaitlistAction, removeWaitlistEntryAction } from "@/app/dashboard/actions";

export type WaitlistRow = { id: string; name: string | null; email: string; status: "waiting" | "offered" | "registered" | "expired"; ticketTypeName: string | null; createdAt: string; holdExpiresAt: string | null };
type TicketOption = { id: string; name: string; priceMinor: number; currency: string; room: number | null };

const fmt = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const variant: Record<WaitlistRow["status"], "default" | "success" | "warning" | "muted" | "outline"> = { waiting: "outline", offered: "warning", registered: "success", expired: "muted" };

export function WaitlistPanel({ eventId, entries, editable, waitlistEnabled, ticketTypes }: { eventId: string; entries: WaitlistRow[]; editable: boolean; waitlistEnabled: boolean; ticketTypes: TicketOption[] }) {
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const defaultType = ticketTypes.find((t) => t.room == null || t.room > 0)?.id ?? ticketTypes[0]?.id ?? "";
  const waiting = entries.filter((e) => e.status === "waiting" || e.status === "expired").length;

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
        {waitlistEnabled
          ? <>When the event sells out, visitors can join this list. Promoting someone holds one seat for them for 24 hours and emails a claim link; unclaimed seats go back to the pool.</>
          : <>The waitlist is off for this event (Edit → Registration options). People who joined earlier are still listed here.</>}
        {entries.length > 0 && <span className="ml-1 text-muted-foreground">{waiting} waiting, {entries.filter((e) => e.status === "offered").length} offered, {entries.filter((e) => e.status === "registered").length} registered.</span>}
      </div>
      <FormMessage error={msg.error} success={msg.success} />
      <Table>
        <THead><TR><TH>Person</TH><TH>Joined</TH><TH>Status</TH>{editable && <TH className="text-right">Actions</TH>}</TR></THead>
        <TBody>
          {entries.length === 0 && <TR><TD colSpan={4} className="py-8 text-center text-muted-foreground">Nobody on the waitlist.</TD></TR>}
          {entries.map((e) => (
            <TR key={e.id}>
              <TD><div className="font-medium">{e.name ?? "—"}</div><div className="text-xs text-muted-foreground">{e.email}</div></TD>
              <TD className="whitespace-nowrap text-muted-foreground">{fmt(e.createdAt)}</TD>
              <TD>
                <Badge variant={variant[e.status]}>{e.status}</Badge>
                {e.status === "offered" && e.holdExpiresAt && <div className="mt-0.5 text-xs text-muted-foreground">{e.ticketTypeName} until {fmt(e.holdExpiresAt)}</div>}
                {e.status === "expired" && <div className="mt-0.5 text-xs text-muted-foreground">Offer lapsed; can be promoted again</div>}
              </TD>
              {editable && (
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {(e.status === "waiting" || e.status === "expired") && ticketTypes.length > 0 && (
                      <>
                        {ticketTypes.length > 1 && (
                          <Select aria-label="Ticket type" className="h-8 w-40 text-xs" value={choice[e.id] ?? defaultType} onChange={(ev) => setChoice((c) => ({ ...c, [e.id]: ev.target.value }))}>
                            {ticketTypes.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.priceMinor === 0 ? "Free" : formatMoney(t.priceMinor, t.currency)}{t.room != null ? ` · ${t.room} left` : ""}</option>)}
                          </Select>
                        )}
                        <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await promoteWaitlistAction(eventId, e.id, choice[e.id] ?? defaultType); setMsg(r.ok ? { success: r.message } : { error: r.error }); router.refresh(); })}>Offer a spot</Button>
                      </>
                    )}
                    {e.status !== "registered" && (
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm(`Remove ${e.email} from the waitlist?${e.status === "offered" ? " Their held seat is released." : ""}`)) start(async () => { const r = await removeWaitlistEntryAction(eventId, e.id); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); }); }}>Remove</Button>
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
