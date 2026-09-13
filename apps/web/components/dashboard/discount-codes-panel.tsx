"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, TicketPercent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";
import { EmptyCell, PanelHeader } from "@/components/dashboard/page-chrome";
import { createDiscountCodeAction, deleteDiscountCodeAction } from "@/app/dashboard/actions";

export type DiscountRow = { id: string; code: string; kind: "percent" | "fixed"; value: number; maxUses: number | null; uses: number; expiresAt: string | null };

const fmt = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

export function DiscountCodesPanel({ eventId, codes, editable, currency }: { eventId: string; codes: DiscountRow[]; editable: boolean; currency: string }) {
  const t = useTranslations("manage");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ code: "", kind: "percent" as "percent" | "fixed", value: "10", maxUses: "", expiresAt: "" });
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = () => start(async () => {
    const r = await createDiscountCodeAction(eventId, {
      code: draft.code, kind: draft.kind, value: draft.kind === "fixed" ? Math.round(Number(draft.value || 0) * 100) : Number(draft.value || 0),
      maxUses: draft.maxUses ? Number(draft.maxUses) : null, expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
    });
    if (!r.ok) return setMsg({ error: r.error });
    setMsg({ success: r.message }); setOpen(false); setDraft({ code: "", kind: "percent", value: "10", maxUses: "", expiresAt: "" }); router.refresh();
  });

  const status = (c: DiscountRow): "expired" | "usedUp" | "active" => (c.expiresAt && new Date(c.expiresAt) <= new Date() ? "expired" : c.maxUses != null && c.uses >= c.maxUses ? "usedUp" : "active");

  return (
    <section className="hairline space-y-4 pt-8">
      <PanelHeader
        title={t("discounts.title")}
        description={t("discounts.description")}
        actions={editable && <Button size="sm" variant="outline" onClick={() => { setMsg({}); setOpen((o) => !o); }}><Plus className="size-4" /> {t("discounts.add")}</Button>}
      />
      <FormMessage error={msg.error} success={msg.success} />
      {open && (
        <div className="animate-rise grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-card sm:grid-cols-[1fr_8rem_8rem_8rem_10rem_auto] sm:items-end">
          <Field label={t("discounts.form.code")} htmlFor="dc-code"><Input id="dc-code" value={draft.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder={t("discounts.form.codePlaceholder")} /></Field>
          <Field label={t("discounts.form.type")} htmlFor="dc-kind"><Select id="dc-kind" value={draft.kind} onChange={(e) => set("kind", e.target.value as "percent" | "fixed")}><option value="percent">{t("discounts.form.kind.percent")}</option><option value="fixed">{t("discounts.form.kind.fixed", { currency })}</option></Select></Field>
          <Field label={draft.kind === "percent" ? t("discounts.form.percent") : t("discounts.form.amount", { currency })} htmlFor="dc-value"><Input id="dc-value" type="number" min={draft.kind === "percent" ? 1 : 0.01} max={draft.kind === "percent" ? 100 : undefined} step={draft.kind === "percent" ? 1 : 0.01} value={draft.value} onChange={(e) => set("value", e.target.value)} /></Field>
          <Field label={t("discounts.form.maxUses")} htmlFor="dc-max"><Input id="dc-max" type="number" min={1} value={draft.maxUses} onChange={(e) => set("maxUses", e.target.value)} placeholder={t("discounts.form.unlimited")} /></Field>
          <Field label={t("discounts.form.expires")} htmlFor="dc-exp"><Input id="dc-exp" type="datetime-local" value={draft.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} /></Field>
          <Button onClick={save} pending={pending} disabled={!draft.code}>{t("discounts.form.create")}</Button>
        </div>
      )}
      <Table>
        <THead className="[&_th]:uppercase [&_th]:tracking-[0.12em]"><TR><TH>{t("discounts.columns.code")}</TH><TH>{t("discounts.columns.discount")}</TH><TH className="text-end">{t("discounts.columns.uses")}</TH><TH>{t("discounts.columns.expires")}</TH><TH>{tc("labels.status")}</TH>{editable && <TH></TH>}</TR></THead>
        <TBody>
          {codes.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={editable ? 6 : 5}>
                <EmptyCell
                  icon={TicketPercent}
                  title={t("discounts.empty.title")}
                  description={t("discounts.empty.description")}
                  action={editable ? <Button size="sm" variant="outline" onClick={() => { setMsg({}); setOpen(true); }}><Plus className="size-4" /> {t("discounts.add")}</Button> : undefined}
                />
              </TD>
            </TR>
          )}
          {codes.map((c) => {
            const st = status(c);
            return (
              <TR key={c.id}>
                <TD className="font-mono text-xs font-medium tracking-wide">{c.code}</TD>
                <TD>{c.kind === "percent" ? t("discounts.percentOff", { value: String(c.value) }) : t("discounts.amountOff", { amount: formatMoney(c.value, currency, locale) })}</TD>
                <TD className="text-end tabular-nums">{c.maxUses != null ? t("discounts.usesOfMax", { uses: c.uses, max: c.maxUses }) : c.uses}</TD>
                <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{c.expiresAt ? fmt(c.expiresAt, locale) : t("discounts.never")}</TD>
                <TD><Badge variant={st === "active" ? "success" : "muted"}>{t(`discounts.status.${st}`)}</Badge></TD>
                {editable && <TD className="text-end"><Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => { if (window.confirm(t("discounts.confirmDelete", { code: c.code }))) start(async () => { const r = await deleteDiscountCodeAction(eventId, c.id); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); }); }}>{tc("actions.delete")}</Button></TD>}
              </TR>
            );
          })}
        </TBody>
      </Table>
    </section>
  );
}
