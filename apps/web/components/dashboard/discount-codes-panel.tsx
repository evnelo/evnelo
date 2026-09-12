"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

const fmt = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

export function DiscountCodesPanel({ eventId, codes, editable, currency }: { eventId: string; codes: DiscountRow[]; editable: boolean; currency: string }) {
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

  const status = (c: DiscountRow) => (c.expiresAt && new Date(c.expiresAt) <= new Date() ? "expired" : c.maxUses != null && c.uses >= c.maxUses ? "used up" : "active");

  return (
    <section className="hairline space-y-4 pt-8">
      <PanelHeader
        title="Discount codes"
        description="Percent or fixed amount off the order. Buyers enter the code at checkout; it applies to every ticket in the order."
        actions={editable && <Button size="sm" variant="outline" onClick={() => { setMsg({}); setOpen((o) => !o); }}><Plus className="size-4" /> Add code</Button>}
      />
      <FormMessage error={msg.error} success={msg.success} />
      {open && (
        <div className="animate-rise grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-card sm:grid-cols-[1fr_8rem_8rem_8rem_10rem_auto] sm:items-end">
          <Field label="Code" htmlFor="dc-code"><Input id="dc-code" value={draft.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="EARLYBIRD" /></Field>
          <Field label="Type" htmlFor="dc-kind"><Select id="dc-kind" value={draft.kind} onChange={(e) => set("kind", e.target.value as "percent" | "fixed")}><option value="percent">% off</option><option value="fixed">{currency} off</option></Select></Field>
          <Field label={draft.kind === "percent" ? "Percent" : `Amount (${currency})`} htmlFor="dc-value"><Input id="dc-value" type="number" min={draft.kind === "percent" ? 1 : 0.01} max={draft.kind === "percent" ? 100 : undefined} step={draft.kind === "percent" ? 1 : 0.01} value={draft.value} onChange={(e) => set("value", e.target.value)} /></Field>
          <Field label="Max uses" htmlFor="dc-max"><Input id="dc-max" type="number" min={1} value={draft.maxUses} onChange={(e) => set("maxUses", e.target.value)} placeholder="unlimited" /></Field>
          <Field label="Expires" htmlFor="dc-exp"><Input id="dc-exp" type="datetime-local" value={draft.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} /></Field>
          <Button onClick={save} pending={pending} disabled={!draft.code}>Create</Button>
        </div>
      )}
      <Table>
        <THead className="[&_th]:uppercase [&_th]:tracking-[0.12em]"><TR><TH>Code</TH><TH>Discount</TH><TH className="text-right">Uses</TH><TH>Expires</TH><TH>Status</TH>{editable && <TH></TH>}</TR></THead>
        <TBody>
          {codes.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={editable ? 6 : 5}>
                <EmptyCell
                  icon={TicketPercent}
                  title="No discount codes"
                  description="Codes are the easiest way to run an early bird, a partner rate or a friends-and-family price."
                  action={editable ? <Button size="sm" variant="outline" onClick={() => { setMsg({}); setOpen(true); }}><Plus className="size-4" /> Add code</Button> : undefined}
                />
              </TD>
            </TR>
          )}
          {codes.map((c) => {
            const st = status(c);
            return (
              <TR key={c.id}>
                <TD className="font-mono text-xs font-medium tracking-wide">{c.code}</TD>
                <TD>{c.kind === "percent" ? `${c.value}% off` : `${formatMoney(c.value, currency)} off`}</TD>
                <TD className="text-right tabular-nums">{c.uses}{c.maxUses != null ? ` / ${c.maxUses}` : ""}</TD>
                <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{c.expiresAt ? fmt(c.expiresAt) : "Never"}</TD>
                <TD><Badge variant={st === "active" ? "success" : "muted"}>{st}</Badge></TD>
                {editable && <TD className="text-right"><Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => { if (window.confirm(`Delete code ${c.code}? Orders that already used it keep their discount.`)) start(async () => { const r = await deleteDiscountCodeAction(eventId, c.id); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); }); }}>Delete</Button></TD>}
              </TR>
            );
          })}
        </TBody>
      </Table>
    </section>
  );
}
