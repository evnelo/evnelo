"use client";

import { useState } from "react";
import { Check, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/utils";

export type AppliedDiscount = { code: string; discountMinor: number; totalMinor: number; currency: string };

/** "Have a code?" disclosure for paid tickets. Validates through the same rules checkout applies. */
export function DiscountCodeField({ eventId, ticketTypeId, quantity, applied, onChange }: { eventId: string; ticketTypeId: string; quantity: number; applied: AppliedDiscount | null; onChange: (d: AppliedDiscount | null) => void }) {
  const [open, setOpen] = useState(Boolean(applied));
  const [code, setCode] = useState(applied?.code ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function apply() {
    if (!code.trim()) return;
    setBusy(true); setError(undefined);
    try {
      const res = await fetch("/api/discounts/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, ticketTypeId, code, quantity }) });
      const data = (await res.json().catch(() => ({}))) as AppliedDiscount & { error?: string };
      if (!res.ok) { setError(data.error ?? "That code isn't valid."); onChange(null); return; }
      onChange({ code: data.code, discountMinor: data.discountMinor, totalMinor: data.totalMinor, currency: data.currency });
    } catch { setError("Network error. Try again."); } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="press inline-flex h-11 items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
        <Tag className="size-3.5" aria-hidden /> Have a discount code?
      </button>
    );
  }
  return (
    <div className="animate-rise">
      <Label htmlFor="discount-code">Discount code</Label>
      <div className="mt-1.5 flex gap-2">
        <Input id="discount-code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); if (applied) onChange(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void apply(); } }} placeholder="CODE" autoCapitalize="characters" spellCheck={false} className="h-11 font-mono uppercase tracking-wider" />
        <Button type="button" variant="outline" className="h-11" disabled={busy || !code.trim()} onClick={() => void apply()}>{busy ? "Checking…" : applied ? <><Check className="size-4" aria-hidden /> Applied</> : "Apply"}</Button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {applied && !error && <p className="mt-1 text-xs text-muted-foreground">{applied.code}: {formatMoney(applied.discountMinor, applied.currency)} off{applied.totalMinor === 0 ? ", your ticket is free" : ""}.</p>}
    </div>
  );
}
