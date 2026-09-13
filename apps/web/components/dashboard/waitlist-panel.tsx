"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FormMessage } from "@/components/ui/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";
import { EmptyCell, Note, PanelHeader } from "@/components/dashboard/page-chrome";
import { promoteWaitlistAction, removeWaitlistEntryAction } from "@/app/dashboard/actions";

export type WaitlistRow = { id: string; name: string | null; email: string; status: "waiting" | "offered" | "registered" | "expired"; ticketTypeName: string | null; createdAt: string; holdExpiresAt: string | null };
type TicketOption = { id: string; name: string; priceMinor: number; currency: string; room: number | null };

const fmt = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const variant: Record<WaitlistRow["status"], "default" | "success" | "warning" | "muted" | "outline"> = { waiting: "outline", offered: "warning", registered: "success", expired: "muted" };

export function WaitlistPanel({ eventId, entries, editable, waitlistEnabled, ticketTypes }: { eventId: string; entries: WaitlistRow[]; editable: boolean; waitlistEnabled: boolean; ticketTypes: TicketOption[] }) {
  const t = useTranslations("manage");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const defaultType = ticketTypes.find((tt) => tt.room == null || tt.room > 0)?.id ?? ticketTypes[0]?.id ?? "";
  const waiting = entries.filter((e) => e.status === "waiting" || e.status === "expired").length;

  const optionLabel = (tt: TicketOption) => {
    const price = tt.priceMinor === 0 ? tc("labels.free") : formatMoney(tt.priceMinor, tt.currency, locale);
    return tt.room != null ? t("waitlist.optionWithRoom", { name: tt.name, price, room: tt.room }) : t("waitlist.option", { name: tt.name, price });
  };

  return (
    <div className="space-y-4">
      <PanelHeader
        title={t("waitlist.title")}
        description={entries.length > 0
          ? t("waitlist.summary", { waiting, offered: entries.filter((e) => e.status === "offered").length, registered: entries.filter((e) => e.status === "registered").length })
          : t("waitlist.description")}
      />
      <Note tone={waitlistEnabled ? "muted" : "warning"}>
        {waitlistEnabled ? t("waitlist.enabledNote") : t("waitlist.disabledNote")}
      </Note>
      <FormMessage error={msg.error} success={msg.success} />
      <Table>
        <THead className="[&_th]:uppercase [&_th]:tracking-[0.12em]"><TR><TH>{t("waitlist.columns.person")}</TH><TH>{t("waitlist.columns.joined")}</TH><TH>{tc("labels.status")}</TH>{editable && <TH className="text-end">{t("waitlist.columns.actions")}</TH>}</TR></THead>
        <TBody>
          {entries.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={editable ? 4 : 3}>
                <EmptyCell icon={Clock3} title={t("waitlist.empty.title")} description={t("waitlist.empty.description")} />
              </TD>
            </TR>
          )}
          {entries.map((e) => (
            <TR key={e.id}>
              <TD><div className="font-medium">{e.name ?? "—"}</div><div className="text-xs text-muted-foreground">{e.email}</div></TD>
              <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{fmt(e.createdAt, locale)}</TD>
              <TD>
                <Badge variant={variant[e.status]}>{t(`waitlist.status.${e.status}`)}</Badge>
                {e.status === "offered" && e.holdExpiresAt && <div className="mt-0.5 text-xs text-muted-foreground">{t("waitlist.heldUntil", { ticketType: e.ticketTypeName ?? "", time: fmt(e.holdExpiresAt, locale) })}</div>}
                {e.status === "expired" && <div className="mt-0.5 text-xs text-muted-foreground">{t("waitlist.lapsed")}</div>}
              </TD>
              {editable && (
                <TD className="text-end">
                  <div className="flex items-center justify-end gap-1">
                    {(e.status === "waiting" || e.status === "expired") && ticketTypes.length > 0 && (
                      <>
                        {ticketTypes.length > 1 && (
                          <Select aria-label={t("waitlist.ticketType")} className="h-8 w-40 text-xs" value={choice[e.id] ?? defaultType} onChange={(ev) => setChoice((c) => ({ ...c, [e.id]: ev.target.value }))}>
                            {ticketTypes.map((tt) => <option key={tt.id} value={tt.id}>{optionLabel(tt)}</option>)}
                          </Select>
                        )}
                        <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await promoteWaitlistAction(eventId, e.id, choice[e.id] ?? defaultType); setMsg(r.ok ? { success: r.message } : { error: r.error }); router.refresh(); })}>{t("waitlist.offer")}</Button>
                      </>
                    )}
                    {e.status !== "registered" && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => { if (window.confirm(e.status === "offered" ? t("waitlist.confirmRemoveOffered", { email: e.email }) : t("waitlist.confirmRemove", { email: e.email }))) start(async () => { const r = await removeWaitlistEntryAction(eventId, e.id); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); }); }}>{tc("actions.remove")}</Button>
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
