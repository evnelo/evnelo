"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Ticket } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyCell, PanelHeader } from "@/components/dashboard/page-chrome";
import { deleteTicketTypeAction, saveTicketTypeAction } from "@/app/dashboard/actions";

export type TicketTypeRow = {
  id: string; name: string; description: string | null; priceMinor: number; currency: string; quantity: number | null; sold: number; held: number;
  minPerOrder: number; maxPerOrder: number; salesStartAt: string | null; salesEndAt: string | null; hidden: boolean; accessCode: string | null; taxRateBps: number;
};

type Draft = { name: string; description: string; price: string; currency: string; quantity: string; minPerOrder: number; maxPerOrder: number; salesStartAt: string; salesEndAt: string; hidden: boolean; accessCode: string; taxRate: string };

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
const empty = (currency: string): Draft => ({ name: "", description: "", price: "0", currency, quantity: "", minPerOrder: 1, maxPerOrder: 10, salesStartAt: "", salesEndAt: "", hidden: false, accessCode: "", taxRate: "0" });
const fromRow = (t: TicketTypeRow): Draft => ({
  name: t.name, description: t.description ?? "", price: (t.priceMinor / 100).toFixed(2), currency: t.currency, quantity: t.quantity == null ? "" : String(t.quantity),
  minPerOrder: t.minPerOrder, maxPerOrder: t.maxPerOrder, salesStartAt: toLocal(t.salesStartAt), salesEndAt: toLocal(t.salesEndAt), hidden: t.hidden, accessCode: t.accessCode ?? "", taxRate: (t.taxRateBps / 100).toString(),
});

export function TicketTypesPanel({ eventId, types, editable, defaultCurrency, guestsEnabled }: { eventId: string; types: TicketTypeRow[]; editable: boolean; defaultCurrency: string; guestsEnabled: boolean }) {
  const t = useTranslations("manage");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState<null | { id?: string; draft: Draft }>(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const d = open?.draft;
  const setD = <K extends keyof Draft>(k: K, val: Draft[K]) => setOpen((o) => (o ? { ...o, draft: { ...o.draft, [k]: val } } : o));

  const save = () => {
    if (!open || !d) return;
    const payload = {
      name: d.name, description: d.description, priceMinor: Math.round(Number(d.price || 0) * 100), currency: d.currency, quantity: d.quantity ? Number(d.quantity) : null,
      minPerOrder: d.minPerOrder, maxPerOrder: d.maxPerOrder, salesStartAt: d.salesStartAt ? new Date(d.salesStartAt).toISOString() : null, salesEndAt: d.salesEndAt ? new Date(d.salesEndAt).toISOString() : null,
      hidden: d.hidden, accessCode: d.accessCode, taxRateBps: Math.round(Number(d.taxRate || 0) * 100),
    };
    start(async () => {
      const r = await saveTicketTypeAction(eventId, payload, open.id);
      if (!r.ok) return setMsg({ error: r.error });
      setMsg({ success: t("ticketTypes.saved") }); setOpen(null); router.refresh();
    });
  };

  const salesWindow = (row: TicketTypeRow) => {
    if (!row.salesStartAt && !row.salesEndAt) return t("ticketTypes.always");
    const start = row.salesStartAt ? new Date(row.salesStartAt).toLocaleDateString(locale) : t("ticketTypes.windowNow");
    const end = row.salesEndAt ? new Date(row.salesEndAt).toLocaleDateString(locale) : t("ticketTypes.windowEvent");
    return t("ticketTypes.window", { start, end });
  };

  return (
    <section className="space-y-4">
      <PanelHeader
        title={t("ticketTypes.title")}
        description={types.length === 0 ? t("ticketTypes.descriptionEmpty") : guestsEnabled ? t("ticketTypes.descriptionGuests") : t("ticketTypes.description")}
        actions={editable && <Button size="sm" onClick={() => { setMsg({}); setOpen({ draft: empty(defaultCurrency) }); }}><Plus className="size-4" /> {t("ticketTypes.add")}</Button>}
      />
      <FormMessage error={msg.error} success={msg.success} />
      <Table>
        <THead className="[&_th]:uppercase [&_th]:tracking-[0.12em]"><TR><TH>{tc("labels.name")}</TH><TH className="text-end">{t("ticketTypes.columns.price")}</TH><TH className="text-end">{t("ticketTypes.columns.sold")}</TH><TH>{t("ticketTypes.columns.salesWindow")}</TH><TH></TH>{editable && <TH className="text-end"></TH>}</TR></THead>
        <TBody>
          {types.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={editable ? 6 : 5}>
                <EmptyCell
                  icon={Ticket}
                  title={t("ticketTypes.empty.title")}
                  description={t("ticketTypes.empty.description")}
                  action={editable ? <Button size="sm" variant="outline" onClick={() => { setMsg({}); setOpen({ draft: empty(defaultCurrency) }); }}><Plus className="size-4" /> {t("ticketTypes.add")}</Button> : undefined}
                />
              </TD>
            </TR>
          )}
          {types.map((row) => (
            <TR key={row.id}>
              <TD><div className="font-medium">{row.name}</div>{row.description && <div className="max-w-md truncate text-xs text-muted-foreground">{row.description}</div>}</TD>
              <TD className="text-end tabular-nums">{row.priceMinor === 0 ? tc("labels.free") : formatMoney(row.priceMinor, row.currency, locale)}{row.taxRateBps > 0 && <div className="text-xs text-muted-foreground">{t("ticketTypes.tax", { rate: String(row.taxRateBps / 100) })}</div>}</TD>
              <TD className="text-end tabular-nums">{row.quantity != null ? t("ticketTypes.soldOfQuantity", { sold: row.sold, quantity: row.quantity }) : row.sold}{row.held > 0 && <div className="text-xs text-muted-foreground">{t("ticketTypes.held", { count: row.held })}</div>}</TD>
              <TD className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{salesWindow(row)}</TD>
              <TD className="space-x-1 rtl:space-x-reverse">{row.hidden && <Badge variant="muted">{t("ticketTypes.badges.hidden")}</Badge>}{row.accessCode && <Badge variant="outline">{t("ticketTypes.badges.code")}</Badge>}</TD>
              {editable && (
                <TD className="text-end">
                  <Button size="sm" variant="ghost" onClick={() => { setMsg({}); setOpen({ id: row.id, draft: fromRow(row) }); }}>{tc("actions.edit")}</Button>
                  {row.sold === 0 && row.held === 0 && <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => { if (window.confirm(t("ticketTypes.confirmDelete", { name: row.name }))) start(async () => { const r = await deleteTicketTypeAction(eventId, row.id); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); }); }}>{tc("actions.delete")}</Button>}
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogTitle>{open?.id ? t("ticketTypes.dialog.editTitle") : t("ticketTypes.dialog.newTitle")}</DialogTitle>
          <DialogDescription>{t("ticketTypes.dialog.description", { currency: d?.currency ?? defaultCurrency })}</DialogDescription>
          {d && (
            <form className="mt-5 space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <Field label={tc("labels.name")} htmlFor="tt-name"><Input id="tt-name" value={d.name} onChange={(e) => setD("name", e.target.value)} required autoFocus /></Field>
              <Field label={t("ticketTypes.form.description")} htmlFor="tt-desc" optional><Textarea id="tt-desc" rows={2} value={d.description} onChange={(e) => setD("description", e.target.value)} /></Field>
              <div className="hairline grid grid-cols-3 gap-3 pt-5">
                <Field label={t("ticketTypes.form.price")} htmlFor="tt-price"><Input id="tt-price" type="number" min={0} step="0.01" value={d.price} onChange={(e) => setD("price", e.target.value)} /></Field>
                <Field label={t("ticketTypes.form.currency")} htmlFor="tt-cur"><Input id="tt-cur" value={d.currency} onChange={(e) => setD("currency", e.target.value.toUpperCase())} maxLength={3} /></Field>
                <Field label={t("ticketTypes.form.tax")} htmlFor="tt-tax"><Input id="tt-tax" type="number" min={0} max={100} step="0.01" value={d.taxRate} onChange={(e) => setD("taxRate", e.target.value)} /></Field>
                <Field label={t("ticketTypes.form.quantity")} htmlFor="tt-qty" help={t("ticketTypes.form.quantityHelp")}><Input id="tt-qty" type="number" min={1} value={d.quantity} onChange={(e) => setD("quantity", e.target.value)} /></Field>
                <Field label={t("ticketTypes.form.minPerOrder")} htmlFor="tt-min"><Input id="tt-min" type="number" min={1} value={d.minPerOrder} onChange={(e) => setD("minPerOrder", Number(e.target.value) || 1)} /></Field>
                <Field label={t("ticketTypes.form.maxPerOrder")} htmlFor="tt-max"><Input id="tt-max" type="number" min={1} value={d.maxPerOrder} onChange={(e) => setD("maxPerOrder", Number(e.target.value) || 1)} /></Field>
              </div>
              <div className="hairline grid grid-cols-2 gap-3 pt-5">
                <Field label={t("ticketTypes.form.salesStart")} htmlFor="tt-ss" optional><Input id="tt-ss" type="datetime-local" value={d.salesStartAt} onChange={(e) => setD("salesStartAt", e.target.value)} /></Field>
                <Field label={t("ticketTypes.form.salesEnd")} htmlFor="tt-se" optional><Input id="tt-se" type="datetime-local" value={d.salesEndAt} onChange={(e) => setD("salesEndAt", e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 items-end gap-3">
                <label className="press flex h-10 cursor-pointer items-center gap-2 text-sm"><Switch checked={d.hidden} onCheckedChange={(c) => setD("hidden", c)} /> {t("ticketTypes.form.hidden")}</label>
                <Field label={t("ticketTypes.form.accessCode")} htmlFor="tt-code" optional><Input id="tt-code" value={d.accessCode} onChange={(e) => setD("accessCode", e.target.value)} /></Field>
              </div>
              <div className="hairline flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => setOpen(null)}>{tc("actions.cancel")}</Button>
                <Button type="submit" pending={pending}>{tc("actions.save")}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
