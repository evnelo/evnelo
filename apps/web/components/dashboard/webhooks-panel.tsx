"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Copy, Plus, Webhook } from "lucide-react";
import { WEBHOOK_EVENTS } from "@evnelo/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyCell, Note, Toolbar } from "@/components/dashboard/page-chrome";
import { createWebhookAction, deleteWebhookAction, rotateWebhookSecretAction, testWebhookAction, updateWebhookAction } from "@/app/dashboard/actions";

export type WebhookRow = { id: string; url: string; events: string[]; active: boolean; createdAt: string; recent: { id: string; event: string; state: string; attempts: number; responseStatus: number | null; createdAt: string }[] };

export function WebhooksPanel({ hooks, editable }: { hooks: WebhookRow[]; editable: boolean }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const locale = useLocale();
  const fmt = (iso: string) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([...WEBHOOK_EVENTS]);
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [secret, setSecret] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const toggle = (e: string) => setEvents((list) => (list.includes(e) ? list.filter((x) => x !== e) : [...list, e]));
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { window.prompt(t("settings.developer.webhooks.copyPrompt"), text); } };

  return (
    <div className="space-y-4">
      <Note>
        {t.rich("settings.developer.webhooks.note", {
          signature: "evnelo-signature: v1=…",
          template: "{timestamp}.{body}",
          code: (chunks) => <code className="rounded bg-card px-1 text-xs">{chunks}</code>,
        })}
      </Note>
      <Toolbar actions={editable && <Button size="sm" variant="outline" onClick={() => { setMsg({}); setSecret(undefined); setOpen((o) => !o); }}><Plus className="size-4" /> {t("settings.developer.webhooks.addWebhook")}</Button>}>
        <p className="eyebrow">{t("settings.developer.webhooks.count", { count: hooks.length })}</p>
      </Toolbar>
      <FormMessage error={msg.error} success={msg.success} />
      {secret && (
        <div className="animate-rise flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-accent px-3 py-2.5 text-sm">
          <span className="eyebrow shrink-0 text-accent-foreground/70">{t("settings.developer.webhooks.signingSecret")}</span><code className="min-w-0 flex-1 truncate font-mono text-xs">{secret}</code>
          <Button size="sm" variant="outline" onClick={() => copy(secret)}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {tc("actions.copy")}</Button>
        </div>
      )}
      {open && (
        <div className="animate-rise space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-card">
          <Field label={t("settings.developer.webhooks.endpointUrl")} htmlFor="wh-url" help={t("settings.developer.webhooks.endpointUrlHelp")}><Input id="wh-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/evnelo" /></Field>
          <fieldset>
            <legend className="eyebrow">{t("settings.developer.webhooks.events")}</legend>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {WEBHOOK_EVENTS.map((e) => (
                <label key={e} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={events.includes(e)} onChange={() => toggle(e)} /> <code className="text-xs">{e}</code></label>
              ))}
            </div>
          </fieldset>
          <Button pending={pending} disabled={!url || events.length === 0} onClick={() => start(async () => {
            const r = await createWebhookAction({ url, events, active: true });
            if (!r.ok) return setMsg({ error: r.error });
            setMsg({ success: r.message }); setSecret(r.secret); setOpen(false); setUrl(""); router.refresh();
          })}>{t("settings.developer.webhooks.create")}</Button>
        </div>
      )}
      <Table>
        <THead className="[&_th]:uppercase [&_th]:tracking-[0.12em]"><TR><TH>{t("settings.developer.webhooks.columns.endpoint")}</TH><TH>{t("settings.developer.webhooks.columns.events")}</TH><TH>{tc("labels.status")}</TH>{editable && <TH className="text-end"></TH>}</TR></THead>
        <TBody>
          {hooks.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={editable ? 4 : 3}>
                <EmptyCell icon={Webhook} title={t("settings.developer.webhooks.empty.title")} description={t("settings.developer.webhooks.empty.description")} />
              </TD>
            </TR>
          )}
          {hooks.map((h) => (
            <TR key={h.id}>
              <TD>
                <div className="max-w-xs truncate font-mono text-xs" title={h.url}>{h.url}</div>
                <button type="button" className="press mt-1 text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground" onClick={() => setExpanded((x) => (x === h.id ? undefined : h.id))}>{expanded === h.id ? t("settings.developer.webhooks.hideDeliveries") : t("settings.developer.webhooks.recentDeliveries", { count: h.recent.length })}</button>
                {expanded === h.id && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {h.recent.length === 0 && <li className="text-muted-foreground">{t("settings.developer.webhooks.nothingDelivered")}</li>}
                    {h.recent.map((d) => (
                      <li key={d.id} className="flex flex-wrap gap-x-2 text-muted-foreground"><code>{d.event}</code><span>{fmt(d.createdAt)}</span><Badge variant={d.state === "delivered" ? "success" : d.state === "failed" ? "destructive" : "warning"}>{t(`status.delivery.${d.state}`)}</Badge><span>{t("settings.developer.webhooks.attempts", { count: d.attempts, hasStatus: d.responseStatus != null ? "true" : "false", status: d.responseStatus ?? 0 })}</span></li>
                    ))}
                  </ul>
                )}
              </TD>
              <TD className="text-xs text-muted-foreground">{h.events.length === WEBHOOK_EVENTS.length ? t("settings.developer.webhooks.allEvents") : h.events.join(", ")}</TD>
              <TD><Badge variant={h.active ? "success" : "muted"}>{h.active ? t("settings.developer.webhooks.active") : t("settings.developer.webhooks.paused")}</Badge></TD>
              {editable && (
                <TD className="text-end">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await testWebhookAction(h.id); setMsg(r.ok ? { success: r.message } : { error: r.error }); })}>{t("settings.developer.webhooks.sendTest")}</Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await updateWebhookAction(h.id, { active: !h.active }); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); })}>{h.active ? t("settings.developer.webhooks.pause") : t("settings.developer.webhooks.resume")}</Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm(t("settings.developer.webhooks.rotateConfirm"))) start(async () => { const r = await rotateWebhookSecretAction(h.id); if (r.ok) { setSecret(r.secret); setMsg({ success: r.message }); } else setMsg({ error: r.error }); }); }}>{t("settings.developer.webhooks.rotateSecret")}</Button>
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => { if (window.confirm(t("settings.developer.webhooks.deleteConfirm"))) start(async () => { const r = await deleteWebhookAction(h.id); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); }); }}>{tc("actions.delete")}</Button>
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
