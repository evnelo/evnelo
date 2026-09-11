"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";
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
    <section className="space-y-4 border-t pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Discount codes</h2>
          <p className="text-sm text-muted-foreground">Percent or fixed amount off the order. Buyers enter the code at checkout; it applies to every ticket in the order.</p>
        </div>
        {editable && <Button size="sm" variant="outline" onClick={() => { setMsg({}); setOpen((o) => !o); }}><Plus className="size-4" /> Add code</Button>}
      </div>
      <FormMessage error={msg.error} success={msg.success} />
      {open && (
        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_8rem_8rem_8rem_10rem_auto] sm:items-end">
          <Field label="Code" htmlFor="dc-code"><Input id="dc-code" value={draft.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="EARLYBIRD" /></Field>
          <Field label="Type" htmlFor="dc-kind"><Select id="dc-kind" value={draft.kind} onChange={(e) => set("kind", e.target.value as "percent" | "fixed")}><option value="percent">% off</option><option value="fixed">{currency} off</option></Select></Field>
          <Field label={draft.kind === "percent" ? "Percent" : `Amount (${currency})`} htmlFor="dc-value"><Input id="dc-value" type="number" min={draft.kind === "percent" ? 1 : 0.01} max={draft.kind === "percent" ? 100 : undefined} step={draft.kind === "percent" ? 1 : 0.01} value={draft.value} onChange={(e) => set("value", e.target.value)} /></Field>
          <Field label="Max uses" htmlFor="dc-max"><Input id="dc-max" type="number" min={1} value={draft.maxUses} onChange={(e) => set("maxUses", e.target.value)} placeholder="unlimited" /></Field>
          <Field label="Expires" htmlFor="dc-exp"><Input id="dc-exp" type="datetime-local" value={draft.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} /></Field>
          <Button onClick={save} disabled={pending || !draft.code}>{pending ? "Saving…" : "Create"}</Button>
        </div>
      )}
      <Table>
        <THead><TR><TH>Code</TH><TH>Discount</TH><TH className="text-right">Uses</TH><TH>Expires</TH><TH>Status</TH>{editable && <TH></TH>}</TR></THead>
        <TBody>
          {codes.length === 0 && <TR><TD colSpan={6} className="py-6 text-center text-muted-foreground">No discount codes.</TD></TR>}
          {codes.map((c) => {
            const st = status(c);
            return (
              <TR key={c.id}>
                <TD className="font-mono">{c.code}</TD>
                <TD>{c.kind === "percent" ? `${c.value}% off` : `${formatMoney(c.value, currency)} off`}</TD>
                <TD className="text-right tabular-nums">{c.uses}{c.maxUses != null ? ` / ${c.maxUses}` : ""}</TD>
                <TD className="text-muted-foreground">{c.expiresAt ? fmt(c.expiresAt) : "Never"}</TD>
                <TD><Badge variant={st === "active" ? "success" : "muted"}>{st}</Badge></TD>
                {editable && <TD className="text-right"><Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm(`Delete code ${c.code}? Orders that already used it keep their discount.`)) start(async () => { const r = await deleteDiscountCodeAction(eventId, c.id); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); }); }}>Delete</Button></TD>}
              </TR>
            );
          })}
        </TBody>
      </Table>
    </section>
  );
}
