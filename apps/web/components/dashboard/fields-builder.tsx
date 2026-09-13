"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ClipboardList, Plus, X } from "lucide-react";
import { FIELD_TYPES, slugify } from "@evnelo/core";
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

const OPS: Rule["op"][] = ["eq", "neq", "contains", "empty", "not_empty"];
const hasOptions = (t: FieldDraft["type"]) => t === "select" || t === "multi_select";

export function FieldsBuilder({ eventId, initial, ticketTypes, editable, guestsEnabled, filesEnabled }: { eventId: string; initial: FieldDraft[]; ticketTypes: { id: string; name: string }[]; editable: boolean; guestsEnabled: boolean; filesEnabled: boolean }) {
  const t = useTranslations("manage");
  const tc = useTranslations("common");
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
        title={t("fields.title")}
        description={t("fields.description")}
        actions={editable && <Button size="sm" onClick={add}><Plus className="size-4" /> {t("fields.add")}</Button>}
      />
      <FormMessage error={msg.error} success={msg.success} />
      <ol className="space-y-2">
        {fields.length === 0 && (
          <li>
            <EmptyState
              icon={ClipboardList}
              title={t("fields.empty.title")}
              description={t("fields.empty.description")}
              action={editable ? <Button size="sm" onClick={add}><Plus className="size-4" /> {t("fields.empty.action")}</Button> : undefined}
            />
          </li>
        )}
        {fields.map((f, i) => {
          const open = openIdx === i;
          const earlier = fields.slice(0, i).filter((x) => x.scope === f.scope && x.key);
          return (
            <li key={f.id ?? `new-${i}`} className={`animate-rise rounded-xl border bg-card shadow-card ${open ? "border-primary/40" : "border-border/80"}`} style={{ ["--stagger" as string]: Math.min(i, 12) }}>
              <div className="flex items-center gap-2 py-2 ps-3 pe-2">
                <button type="button" onClick={() => setOpenIdx(open ? null : i)} className="press flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-md py-1 text-start">
                  <span className="eyebrow w-5 shrink-0 tabular-nums">{i + 1}</span>
                  <span className="truncate text-sm font-medium">{f.label || <span className="text-muted-foreground">{t("fields.untitled")}</span>}</span>
                  <Badge variant="muted">{t(`fields.types.${f.type}`)}</Badge>
                  <Badge variant="outline">{t(`fields.scopes.${f.scope}`)}</Badge>
                  {f.required && <Badge variant="warning">{t("fields.badges.required")}</Badge>}
                  {f.condition && <Badge variant="outline">{t("fields.badges.conditional")}</Badge>}
                </button>
                {editable && (
                  <div className="flex shrink-0 items-center">
                    <Button type="button" variant="ghost" size="icon" aria-label={t("fields.moveUp")} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={t("fields.moveDown")} disabled={i === fields.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={tc("actions.remove")} onClick={() => { setFields((fs) => fs.filter((_, j) => j !== i)); setOpenIdx(null); }}><X className="size-4" /></Button>
                  </div>
                )}
              </div>
              {open && (
                <fieldset disabled={!editable} className="hairline grid gap-5 p-4 sm:grid-cols-2">
                  <Field label={t("fields.question")} htmlFor={`f-${i}-label`}><Input id={`f-${i}-label`} value={f.label} onChange={(e) => update(i, { label: e.target.value, key: f.id ? f.key : slugify(e.target.value, 60).replace(/-/g, "_") })} /></Field>
                  <Field label={t("fields.key")} htmlFor={`f-${i}-key`} help={t("fields.keyHelp")}><Input id={`f-${i}-key`} value={f.key} onChange={(e) => update(i, { key: e.target.value })} pattern="[a-z0-9_]{1,60}" /></Field>
                  <Field label={t("fields.type")} htmlFor={`f-${i}-type`} help={!filesEnabled && f.type !== "file" ? t("fields.fileNeedsS3") : undefined}>
                    <Select id={`f-${i}-type`} value={f.type} onChange={(e) => update(i, { type: e.target.value as FieldDraft["type"] })}>
                      {FIELD_TYPES.filter((ft) => ft !== "file" || filesEnabled || f.type === "file").map((ft) => <option key={ft} value={ft}>{t(`fields.types.${ft}`)}</option>)}
                    </Select>
                    {!filesEnabled && f.type === "file" && <p className="mt-1.5 text-xs text-destructive">{t("fields.fileUnavailable")}</p>}
                  </Field>
                  <Field label={t("fields.asked")} htmlFor={`f-${i}-scope`}><Select id={`f-${i}-scope`} value={f.scope} onChange={(e) => update(i, { scope: e.target.value as FieldDraft["scope"], condition: null })}><option value="attendee">{t("fields.scopes.attendee")}</option><option value="order">{t("fields.scopes.order")}</option>{guestsEnabled && <option value="guest">{t("fields.scopes.guest")}</option>}</Select></Field>
                  {hasOptions(f.type) && (
                    <Field label={t("fields.options")} htmlFor={`f-${i}-opts`} help={t("fields.optionsHelp")} className="sm:col-span-2">
                      <Textarea id={`f-${i}-opts`} rows={4} value={f.optionsText ?? formatOptions(f.options)} onChange={(e) => update(i, { optionsText: e.target.value })} />
                    </Field>
                  )}
                  <Field label={t("fields.helpText")} htmlFor={`f-${i}-help`} optional><Input id={`f-${i}-help`} value={f.helpText} onChange={(e) => update(i, { helpText: e.target.value })} /></Field>
                  <Field label={t("fields.placeholder")} htmlFor={`f-${i}-ph`} optional><Input id={`f-${i}-ph`} value={f.placeholder} onChange={(e) => update(i, { placeholder: e.target.value })} /></Field>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={f.required} onCheckedChange={(c) => update(i, { required: c })} /> {tc("labels.required")} {f.condition && <span className="text-xs text-muted-foreground">{t("fields.requiredOnlyWhenShown")}</span>}</label>
                  {f.scope !== "order" && ticketTypes.length > 1 && (
                    <div className="sm:col-span-2">
                      <p className="text-sm font-medium">{t("fields.onlyForTicketTypes")} <span className="font-normal text-muted-foreground">{t("fields.noneSelectedIsAll")}</span></p>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm">
                        {ticketTypes.map((tt) => (
                          <label key={tt.id} className="flex items-center gap-1.5"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={f.ticketTypeIds.includes(tt.id)} onChange={(e) => update(i, { ticketTypeIds: e.target.checked ? [...f.ticketTypeIds, tt.id] : f.ticketTypeIds.filter((x) => x !== tt.id) })} /> {tt.name}</label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm"><Switch checked={!!f.condition} disabled={earlier.length === 0} onCheckedChange={(c) => update(i, { condition: c ? { op: "and", rules: [{ fieldKey: earlier[0]!.key, op: "eq", value: "" }] } : null })} /> {t("fields.condition")}{earlier.length === 0 && <span className="text-xs text-muted-foreground">{t("fields.conditionNeedsEarlier")}</span>}</label>
                    {f.condition && (
                      <div className="mt-3 space-y-2 rounded-lg border border-border/80 bg-muted/25 p-3">
                        <div className="flex items-center gap-2 text-sm">
                          {t.rich("fields.showWhen", {
                            select: () => <div className="w-24"><Select value={f.condition!.op} aria-label={t("fields.allOrAny")} onChange={(e) => update(i, { condition: { ...f.condition!, op: e.target.value as "and" | "or" } })}><option value="and">{t("fields.match.and")}</option><option value="or">{t("fields.match.or")}</option></Select></div>,
                          })}
                        </div>
                        {f.condition.rules.map((r, ri) => {
                          const target = earlier.find((x) => x.key === r.fieldKey);
                          const setRule = (patch: Partial<Rule>) => update(i, { condition: { ...f.condition!, rules: f.condition!.rules.map((x, k) => (k === ri ? { ...x, ...patch } : x)) } });
                          return (
                            <div key={ri} className="grid gap-2 sm:grid-cols-[1fr_9rem_1fr_auto]">
                              <Select value={r.fieldKey} aria-label={t("fields.rule.field")} onChange={(e) => setRule({ fieldKey: e.target.value, value: "" })}>{earlier.map((x) => <option key={x.key} value={x.key}>{x.label || x.key}</option>)}</Select>
                              <Select value={r.op} aria-label={t("fields.rule.operator")} onChange={(e) => setRule({ op: e.target.value as Rule["op"] })}>{OPS.map((op) => <option key={op} value={op}>{t(`fields.ops.${op}`)}</option>)}</Select>
                              {r.op === "empty" || r.op === "not_empty" ? <div /> : target && hasOptions(target.type) ? (
                                <Select value={r.value ?? ""} aria-label={t("fields.rule.value")} onChange={(e) => setRule({ value: e.target.value })}><option value="">{t("fields.rule.choose")}</option>{optionsOf(target).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
                              ) : target?.type === "checkbox" || target?.type === "consent" ? (
                                <Select value={r.value ?? ""} aria-label={t("fields.rule.value")} onChange={(e) => setRule({ value: e.target.value })}><option value="true">{t("fields.rule.checked")}</option><option value="">{t("fields.rule.unchecked")}</option></Select>
                              ) : (
                                <Input value={r.value ?? ""} aria-label={t("fields.rule.value")} onChange={(e) => setRule({ value: e.target.value })} />
                              )}
                              <Button type="button" variant="ghost" size="icon" aria-label={t("fields.rule.remove")} disabled={f.condition!.rules.length === 1} onClick={() => update(i, { condition: { ...f.condition!, rules: f.condition!.rules.filter((_, k) => k !== ri) } })}><X className="size-4" /></Button>
                            </div>
                          );
                        })}
                        {f.condition.rules.length < 5 && <Button type="button" variant="outline" size="sm" onClick={() => update(i, { condition: { ...f.condition!, rules: [...f.condition!.rules, { fieldKey: earlier[0]!.key, op: "eq", value: "" }] } })}><Plus className="size-4" /> {t("fields.rule.add")}</Button>}
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
          <p className="text-xs text-muted-foreground">{t("fields.dependNote")}</p>
          <Button onClick={save} pending={pending}>{t("fields.save")}</Button>
        </div>
      )}
    </div>
  );
}
