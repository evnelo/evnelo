"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
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
    <div className="space-y-6">
      <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
        {visibility === "private"
          ? "This event is private: only people who open an invitation link (or members of your organization) can see it and register. Email invites only work with the address they were sent to."
          : <>Invitations only restrict access on <strong>private</strong> events. This event is {visibility}, so anyone with the link can register; you can still send invites as a courtesy.</>}
      </div>

      {editable && (
        <form
          className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end"
          action={(fd) => start(async () => {
            const r = await createEventInviteAction(eventId, fd);
            if (!r.ok) return setMsg({ error: r.error });
            setMsg({ success: r.message }); setCreated(r.url); router.refresh();
          })}
        >
          <Field label="Email" htmlFor="inv-email" help="Leave empty for a shareable link anyone can use."><Input id="inv-email" name="email" type="email" placeholder="guest@example.com" /></Field>
          <Field label="Max uses" htmlFor="inv-max"><Input id="inv-max" name="maxUses" type="number" min={1} max={10000} defaultValue={1} /></Field>
          <Field label="Expires in (days)" htmlFor="inv-exp"><Input id="inv-exp" name="expiresInDays" type="number" min={1} max={365} placeholder="never" /></Field>
          <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create invite"}</Button>
        </form>
      )}
      <FormMessage error={msg.error} success={msg.success} />
      {created && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
          <code className="truncate text-xs">{created}</code>
          <Button size="sm" variant="outline" onClick={() => copy(created)}>{copied === created ? <Check className="size-4" /> : <Copy className="size-4" />} Copy link</Button>
        </div>
      )}

      <Table>
        <THead><TR><TH>Invite</TH><TH>Uses</TH><TH>Expires</TH><TH>Status</TH><TH className="text-right"></TH></TR></THead>
        <TBody>
          {invites.length === 0 && <TR><TD colSpan={5} className="py-8 text-center text-muted-foreground">No invitations yet.</TD></TR>}
          {invites.map((i) => {
            const url = `${appUrl}/i/${i.token}`;
            const st = status(i);
            return (
              <TR key={i.id}>
                <TD><div className="font-medium">{i.email ?? "Shareable link"}</div><div className="text-xs text-muted-foreground">Created {fmt(i.createdAt)}</div></TD>
                <TD className="tabular-nums">{i.uses} / {i.maxUses}</TD>
                <TD className="text-muted-foreground">{i.expiresAt ? fmt(i.expiresAt) : "Never"}</TD>
                <TD><Badge variant={st === "active" ? "success" : "muted"}>{st}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => copy(url)}>{copied === url ? <Check className="size-4" /> : <Copy className="size-4" />} Copy</Button>
                    {editable && <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Revoke this invitation? The link stops working immediately.")) start(async () => { const r = await deleteEventInviteAction(eventId, i.id); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); }); }}>Revoke</Button>}
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
