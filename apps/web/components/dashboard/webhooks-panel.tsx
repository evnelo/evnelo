"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus } from "lucide-react";
import { WEBHOOK_EVENTS } from "@ot/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { createWebhookAction, deleteWebhookAction, rotateWebhookSecretAction, testWebhookAction, updateWebhookAction } from "@/app/dashboard/actions";

export type WebhookRow = { id: string; url: string; events: string[]; active: boolean; createdAt: string; recent: { id: string; event: string; state: string; attempts: number; responseStatus: number | null; createdAt: string }[] };

const fmt = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export function WebhooksPanel({ hooks, editable }: { hooks: WebhookRow[]; editable: boolean }) {
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
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { window.prompt("Copy this secret", text); } };

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">Webhooks</h2>
          <p className="text-sm text-muted-foreground">We POST a JSON envelope to your URL for the events you pick, signed with HMAC-SHA256 (<code className="text-xs">openticket-signature: v1=…</code> over <code className="text-xs">{"{timestamp}.{body}"}</code>). Failed deliveries retry with backoff for about a day.</p>
        </div>
        {editable && <Button size="sm" variant="outline" onClick={() => { setMsg({}); setSecret(undefined); setOpen((o) => !o); }}><Plus className="size-4" /> Add webhook</Button>}
      </div>
      <FormMessage error={msg.error} success={msg.success} />
      {secret && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">Signing secret:</span><code className="truncate text-xs">{secret}</code>
          <Button size="sm" variant="outline" onClick={() => copy(secret)}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy</Button>
        </div>
      )}
      {open && (
        <div className="space-y-3 rounded-lg border p-4">
          <Field label="Endpoint URL" htmlFor="wh-url" help="https only (http://localhost is allowed for development)."><Input id="wh-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/openticket" /></Field>
          <fieldset>
            <legend className="text-sm font-medium">Events</legend>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {WEBHOOK_EVENTS.map((e) => (
                <label key={e} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={events.includes(e)} onChange={() => toggle(e)} /> <code className="text-xs">{e}</code></label>
              ))}
            </div>
          </fieldset>
          <Button disabled={pending || !url || events.length === 0} onClick={() => start(async () => {
            const r = await createWebhookAction({ url, events, active: true });
            if (!r.ok) return setMsg({ error: r.error });
            setMsg({ success: r.message }); setSecret(r.secret); setOpen(false); setUrl(""); router.refresh();
          })}>{pending ? "Saving…" : "Create webhook"}</Button>
        </div>
      )}
      <Table>
        <THead><TR><TH>Endpoint</TH><TH>Events</TH><TH>Status</TH>{editable && <TH className="text-right"></TH>}</TR></THead>
        <TBody>
          {hooks.length === 0 && <TR><TD colSpan={4} className="py-6 text-center text-muted-foreground">No webhooks yet.</TD></TR>}
          {hooks.map((h) => (
            <TR key={h.id}>
              <TD>
                <div className="max-w-xs truncate font-mono text-xs" title={h.url}>{h.url}</div>
                <button type="button" className="mt-1 text-xs text-muted-foreground underline underline-offset-4" onClick={() => setExpanded((x) => (x === h.id ? undefined : h.id))}>{expanded === h.id ? "Hide deliveries" : `Recent deliveries (${h.recent.length})`}</button>
                {expanded === h.id && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {h.recent.length === 0 && <li className="text-muted-foreground">Nothing delivered yet.</li>}
                    {h.recent.map((d) => (
                      <li key={d.id} className="flex flex-wrap gap-x-2 text-muted-foreground"><code>{d.event}</code><span>{fmt(d.createdAt)}</span><Badge variant={d.state === "delivered" ? "success" : d.state === "failed" ? "destructive" : "warning"}>{d.state}</Badge><span>{d.attempts} attempt{d.attempts === 1 ? "" : "s"}{d.responseStatus != null ? `, last ${d.responseStatus}` : ""}</span></li>
                    ))}
                  </ul>
                )}
              </TD>
              <TD className="text-xs text-muted-foreground">{h.events.length === WEBHOOK_EVENTS.length ? "All events" : h.events.join(", ")}</TD>
              <TD><Badge variant={h.active ? "success" : "muted"}>{h.active ? "active" : "paused"}</Badge></TD>
              {editable && (
                <TD className="text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await testWebhookAction(h.id); setMsg(r.ok ? { success: r.message } : { error: r.error }); })}>Send test</Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await updateWebhookAction(h.id, { active: !h.active }); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); })}>{h.active ? "Pause" : "Resume"}</Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Rotate the signing secret? The old one stops working immediately.")) start(async () => { const r = await rotateWebhookSecretAction(h.id); if (r.ok) { setSecret(r.secret); setMsg({ success: r.message }); } else setMsg({ error: r.error }); }); }}>Rotate secret</Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Delete this webhook?")) start(async () => { const r = await deleteWebhookAction(h.id); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); }); }}>Delete</Button>
                  </div>
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>
    </section>
  );
}
