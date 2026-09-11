"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyCell, Note, PanelHeader } from "@/components/dashboard/page-chrome";
import { createEventInviteAction, deleteEventInviteAction } from "@/app/dashboard/actions";

export type InviteRow = { id: string; token: string; email: string | null; maxUses: number; uses: number; expiresAt: string | null; createdAt: string };

const fmt = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
const status = (i: InviteRow) => (i.expiresAt && new Date(i.expiresAt) <= new Date() ? "expired" : i.uses >= i.maxUses ? "used up" : "active");

export function InvitesPanel({ eventId, invites, editable, visibility, appUrl }: { eventId: string; invites: InviteRow[]; editable: boolean; visibility: string; appUrl: string }) {
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [created, setCreated] = useState<string>();
  const [copied, setCopied] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();

  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(undefined), 1500); } catch { window.prompt("Copy this link", url); }
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        title="Invitations"
        description="One link per guest, or one link for everyone. Each invite tracks how many times it has been used."
      />
      <Note tone={visibility === "private" ? "muted" : "warning"}>
        {visibility === "private"
          ? "This event is private: only people who open an invitation link (or members of your organization) can see it and register. Email invites only work with the address they were sent to."
          : <>Invitations only restrict access on <strong>private</strong> events. This event is {visibility}, so anyone with the link can register; you can still send invites as a courtesy.</>}
      </Note>

      {editable && (
        <form
          className="rounded-xl border border-border/80 bg-card p-4 shadow-card"
          action={(fd) => start(async () => {
            const r = await createEventInviteAction(eventId, fd);
            if (!r.ok) return setMsg({ error: r.error });
            setMsg({ success: r.message }); setCreated(r.url); router.refresh();
          })}
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end">
            <Field label="Email" htmlFor="inv-email"><Input id="inv-email" name="email" type="email" placeholder="guest@example.com" /></Field>
            <Field label="Max uses" htmlFor="inv-max"><Input id="inv-max" name="maxUses" type="number" min={1} max={10000} defaultValue={1} /></Field>
            <Field label="Expires in (days)" htmlFor="inv-exp"><Input id="inv-exp" name="expiresInDays" type="number" min={1} max={365} placeholder="never" /></Field>
            <Button type="submit" disabled={pending}><Plus className="size-4" /> {pending ? "Creating…" : "Create invite"}</Button>
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">Leave the email empty for a shareable link anyone can use.</p>
        </form>
      )}
      <FormMessage error={msg.error} success={msg.success} />
      {created && (
        <div className="animate-rise flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-accent px-3 py-2.5 text-sm">
          <span className="eyebrow shrink-0 text-accent-foreground/70">New link</span>
          <code className="min-w-0 flex-1 truncate font-mono text-xs">{created}</code>
          <Button size="sm" variant="outline" onClick={() => copy(created)}>{copied === created ? <Check className="size-4" /> : <Copy className="size-4" />} Copy link</Button>
        </div>
      )}

      <Table>
        <THead className="[&_th]:uppercase [&_th]:tracking-[0.12em]"><TR><TH>Invite</TH><TH>Uses</TH><TH>Expires</TH><TH>Status</TH><TH className="text-right"></TH></TR></THead>
        <TBody>
          {invites.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={5}>
                <EmptyCell icon={Mail} title="No invitations yet" description="Create one above to hand out a link, or address it to a single email." />
              </TD>
            </TR>
          )}
          {invites.map((i) => {
            const url = `${appUrl}/i/${i.token}`;
            const st = status(i);
            return (
              <TR key={i.id}>
                <TD><div className="font-medium">{i.email ?? "Shareable link"}</div><div className="text-xs text-muted-foreground">Created {fmt(i.createdAt)}</div></TD>
                <TD className="tabular-nums text-muted-foreground">{i.uses} / {i.maxUses}</TD>
                <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{i.expiresAt ? fmt(i.expiresAt) : "Never"}</TD>
                <TD><Badge variant={st === "active" ? "success" : "muted"}>{st}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => copy(url)}>{copied === url ? <Check className="size-4" /> : <Copy className="size-4" />} Copy</Button>
                    {editable && <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => { if (window.confirm("Revoke this invitation? The link stops working immediately.")) start(async () => { const r = await deleteEventInviteAction(eventId, i.id); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); }); }}>Revoke</Button>}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
