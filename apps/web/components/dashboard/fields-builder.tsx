"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ClipboardList, Plus, X } from "lucide-react";
import { FIELD_TYPES, FIELD_TYPE_LABELS, slugify } from "@evnelo/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Field, FormMessage } from "@/components/ui/form-field";
import { EmptyState, PanelHeader } from "@/components/dashboard/page-chrome";
import { saveFieldsAction } from "@/app/dashboard/actions";

type Rule = { fieldKey: string; op: "eq" | "neq" | "contains" | "empty" | "not_empty"; value?: string };
type Condition = { op: "and" | "or"; rules: Rule[] };
export type FieldDraft = {
  id?: string; key: string; label: string; helpText: string; placeholder: string; type: (typeof FIELD_TYPES)[number];
  options: { value: string; label: string }[]; required: boolean; scope: "attendee" | "order" | "guest"; ticketTypeIds: string[]; condition: Condition | null;
  /** Raw textarea contents while editing; parsed into `options` on save so typing isn't normalised away. */
  optionsText?: string;
};

const formatOptions = (o: { value: string; label: string }[]) => o.map((x) => (x.value === x.label ? x.label : `${x.value} | ${x.label}`)).join("\n");
const parseOptions = (text: string) =>
  text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [a, b] = l.split("|").map((s) => s.trim());
    return b ? { value: a!, label: b } : { value: a!, label: a! };
  });
const optionsOf = (f: FieldDraft) => (f.optionsText != null ? parseOptions(f.optionsText) : f.options);

const SCOPE_LABELS = { attendee: "Each registrant", order: "Once per order", guest: "Each guest" } as const;
const OP_LABELS: Record<Rule["op"], string> = { eq: "is", neq: "is not", contains: "contains", empty: "is empty", not_empty: "is not empty" };
const hasOptions = (t: FieldDraft["type"]) => t === "select" || t === "multi_select";

export function FieldsBuilder({ eventId, initial, ticketTypes, editable, guestsEnabled, filesEnabled }: { eventId: string; initial: FieldDraft[]; ticketTypes: { id: string; name: string }[]; editable: boolean; guestsEnabled: boolean; filesEnabled: boolean }) {
  const [fields, setFields] = useState<FieldDraft[]>(() => initial.map((f) => ({ ...f, optionsText: formatOptions(f.options) })));
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [pending, start] = useTransition();
  const router = useRouter();

  const update = (i: number, patch: Partial<FieldDraft>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, dir: -1 | 1) => setFields((fs) => { const n = [...fs]; const j = i + dir; if (j < 0 || j >= n.length) return fs; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const add = () => { setFields((fs) => [...fs, { key: "", label: "", helpText: "", placeholder: "", type: "short_text", options: [], optionsText: "", required: false, scope: "attendee", ticketTypeIds: [], condition: null }]); setOpenIdx(fields.length); };
  const save = () => start(async () => {
    const r = await saveFieldsAction(eventId, fields.map(({ optionsText: _t, ...f }) => ({ ...f, options: hasOptions(f.type) ? optionsOf({ ...f, optionsText: _t }) : null, ticketTypeIds: f.ticketTypeIds.length ? f.ticketTypeIds : null })));
    setMsg(r.ok ? { success: r.message } : { error: r.error });
    if (r.ok) router.refresh();
  });

  return (
    <div className="space-y-4">
      <PanelHeader
        title="Registration form"
        description="Name and email are always asked. Your own questions can apply to the registrant, the whole order or each guest, and can appear only when an earlier answer matches."
        actions={editable && <Button size="sm" onClick={add}><Plus className="size-4" /> Add question</Button>}
      />
      <FormMessage error={msg.error} success={msg.success} />
      <ol className="space-y-2">
        {fields.length === 0 && (
          <li>
            <EmptyState
              icon={ClipboardList}
              title="Just name and email"
              description="Add a question when you need something more — a dietary note, a company, a t-shirt size."
              action={editable ? <Button size="sm" onClick={add}><Plus className="size-4" /> Add your first question</Button> : undefined}
            />
          </li>
        )}
        {fields.map((f, i) => {
          const open = openIdx === i;
          const earlier = fields.slice(0, i).filter((x) => x.scope === f.scope && x.key);
          return (
            <li key={f.id ?? `new-${i}`} className={`animate-rise rounded-xl border bg-card shadow-card ${open ? "border-primary/40" : "border-border/80"}`} style={{ ["--stagger" as string]: Math.min(i, 12) }}>
              <div className="flex items-center gap-2 py-2 pl-3 pr-2">
                <button type="button" onClick={() => setOpenIdx(open ? null : i)} className="press flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-md py-1 text-left">
                  <span className="eyebrow w-5 shrink-0 tabular-nums">{i + 1}</span>
                  <span className="truncate text-sm font-medium">{f.label || <span className="text-muted-foreground">Untitled question</span>}</span>
                  <Badge variant="muted">{FIELD_TYPE_LABELS[f.type]}</Badge>
                  <Badge variant="outline">{SCOPE_LABELS[f.scope]}</Badge>
                  {f.required && <Badge variant="warning">required</Badge>}
                  {f.condition && <Badge variant="outline">conditional</Badge>}
                </button>
                {editable && (
                  <div className="flex shrink-0 items-center">
                    <Button type="button" variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Move down" disabled={i === fields.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => { setFields((fs) => fs.filter((_, j) => j !== i)); setOpenIdx(null); }}><X className="size-4" /></Button>
                  </div>
                )}
              </div>
              {open && (
                <fieldset disabled={!editable} className="hairline grid gap-5 p-4 sm:grid-cols-2">
                  <Field label="Question" htmlFor={`f-${i}-label`}><Input id={`f-${i}-label`} value={f.label} onChange={(e) => update(i, { label: e.target.value, key: f.id ? f.key : slugify(e.target.value, 60).replace(/-/g, "_") })} /></Field>
                  <Field label="Key" htmlFor={`f-${i}-key`} help="Column name in exports and the API. Lowercase, underscores."><Input id={`f-${i}-key`} value={f.key} onChange={(e) => update(i, { key: e.target.value })} pattern="[a-z0-9_]{1,60}" /></Field>
                  <Field label="Type" htmlFor={`f-${i}-type`} help={!filesEnabled && f.type !== "file" ? "File upload needs S3 storage configured on this instance." : undefined}>
                    <Select id={`f-${i}-type`} value={f.type} onChange={(e) => update(i, { type: e.target.value as FieldDraft["type"] })}>
                      {FIELD_TYPES.filter((t) => t !== "file" || filesEnabled || f.type === "file").map((t) => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
                    </Select>
                    {!filesEnabled && f.type === "file" && <p className="mt-1.5 text-xs text-destructive">S3 storage is not configured, so registrants cannot upload this file. The form shows it as unavailable.</p>}
                  </Field>
                  <Field label="Asked" htmlFor={`f-${i}-scope`}><Select id={`f-${i}-scope`} value={f.scope} onChange={(e) => update(i, { scope: e.target.value as FieldDraft["scope"], condition: null })}><option value="attendee">{SCOPE_LABELS.attendee}</option><option value="order">{SCOPE_LABELS.order}</option>{guestsEnabled && <option value="guest">{SCOPE_LABELS.guest}</option>}</Select></Field>
                  {hasOptions(f.type) && (
                    <Field label="Options" htmlFor={`f-${i}-opts`} help="One per line. Use “value | Label” to store a different value." className="sm:col-span-2">
                      <Textarea id={`f-${i}-opts`} rows={4} value={f.optionsText ?? formatOptions(f.options)} onChange={(e) => update(i, { optionsText: e.target.value })} />
                    </Field>
                  )}
                  <Field label="Help text" htmlFor={`f-${i}-help`} optional><Input id={`f-${i}-help`} value={f.helpText} onChange={(e) => update(i, { helpText: e.target.value })} /></Field>
                  <Field label="Placeholder" htmlFor={`f-${i}-ph`} optional><Input id={`f-${i}-ph`} value={f.placeholder} onChange={(e) => update(i, { placeholder: e.target.value })} /></Field>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={f.required} onCheckedChange={(c) => update(i, { required: c })} /> Required {f.condition && <span className="text-xs text-muted-foreground">(only when shown)</span>}</label>
                  {f.scope !== "order" && ticketTypes.length > 1 && (
                    <div className="sm:col-span-2">
                      <p className="text-sm font-medium">Only for these ticket types <span className="font-normal text-muted-foreground">(none selected = all)</span></p>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm">
                        {ticketTypes.map((t) => (
                          <label key={t.id} className="flex items-center gap-1.5"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={f.ticketTypeIds.includes(t.id)} onChange={(e) => update(i, { ticketTypeIds: e.target.checked ? [...f.ticketTypeIds, t.id] : f.ticketTypeIds.filter((x) => x !== t.id) })} /> {t.name}</label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm"><Switch checked={!!f.condition} disabled={earlier.length === 0} onCheckedChange={(c) => update(i, { condition: c ? { op: "and", rules: [{ fieldKey: earlier[0]!.key, op: "eq", value: "" }] } : null })} /> Show only when an earlier answer matches{earlier.length === 0 && <span className="text-xs text-muted-foreground">(add a question above it first)</span>}</label>
                    {f.condition && (
                      <div className="mt-3 space-y-2 rounded-lg border border-border/80 bg-muted/25 p-3">
                        <div className="flex items-center gap-2 text-sm">Show when <div className="w-24"><Select value={f.condition.op} aria-label="All or any" onChange={(e) => update(i, { condition: { ...f.condition!, op: e.target.value as "and" | "or" } })}><option value="and">all</option><option value="or">any</option></Select></div> of these match:</div>
                        {f.condition.rules.map((r, ri) => {
                          const target = earlier.find((x) => x.key === r.fieldKey);
                          const setRule = (patch: Partial<Rule>) => update(i, { condition: { ...f.condition!, rules: f.condition!.rules.map((x, k) => (k === ri ? { ...x, ...patch } : x)) } });
                          return (
                            <div key={ri} className="grid gap-2 sm:grid-cols-[1fr_9rem_1fr_auto]">
                              <Select value={r.fieldKey} aria-label="Field" onChange={(e) => setRule({ fieldKey: e.target.value, value: "" })}>{earlier.map((x) => <option key={x.key} value={x.key}>{x.label || x.key}</option>)}</Select>
                              <Select value={r.op} aria-label="Operator" onChange={(e) => setRule({ op: e.target.value as Rule["op"] })}>{(Object.keys(OP_LABELS) as Rule["op"][]).map((op) => <option key={op} value={op}>{OP_LABELS[op]}</option>)}</Select>
                              {r.op === "empty" || r.op === "not_empty" ? <div /> : target && hasOptions(target.type) ? (
                                <Select value={r.value ?? ""} aria-label="Value" onChange={(e) => setRule({ value: e.target.value })}><option value="">Choose…</option>{optionsOf(target).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
                              ) : target?.type === "checkbox" || target?.type === "consent" ? (
                                <Select value={r.value ?? ""} aria-label="Value" onChange={(e) => setRule({ value: e.target.value })}><option value="true">checked</option><option value="">unchecked</option></Select>
                              ) : (
                                <Input value={r.value ?? ""} aria-label="Value" onChange={(e) => setRule({ value: e.target.value })} />
                              )}
                              <Button type="button" variant="ghost" size="icon" aria-label="Remove rule" disabled={f.condition!.rules.length === 1} onClick={() => update(i, { condition: { ...f.condition!, rules: f.condition!.rules.filter((_, k) => k !== ri) } })}><X className="size-4" /></Button>
                            </div>
                          );
                        })}
                        {f.condition.rules.length < 5 && <Button type="button" variant="outline" size="sm" onClick={() => update(i, { condition: { ...f.condition!, rules: [...f.condition!.rules, { fieldKey: earlier[0]!.key, op: "eq", value: "" }] } })}><Plus className="size-4" /> Add rule</Button>}
                      </div>
                    )}
                  </div>
                </fieldset>
              )}
            </li>
          );
        })}
      </ol>
      {editable && (
        <div className="hairline flex items-center justify-between gap-4 pt-4">
          <p className="text-xs text-muted-foreground">A question may only depend on one positioned above it.</p>
          <Button onClick={save} pending={pending}>Save form</Button>
        </div>
      )}
    </div>
  );
}
