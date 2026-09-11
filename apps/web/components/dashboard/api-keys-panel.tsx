"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyCell, Note } from "@/components/dashboard/page-chrome";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/dashboard/actions";

type Key = { id: string; name: string; prefix: string; scopes: string[]; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };

export function ApiKeysPanel({ keys, canManage, docsUrl }: { keys: Key[]; canManage: boolean; docsUrl: string }) {
  const [secret, setSecret] = useState<string>();
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "never");

  return (
    <div className="space-y-4">
      <Note>
        Keys call the <a href={docsUrl} className="underline decoration-dotted underline-offset-4">REST API</a> as this organization. Send them as <code className="rounded bg-card px-1 text-xs">Authorization: Bearer ot_live_…</code>. Read keys list and fetch; write keys also create.
      </Note>
      {secret && (
        <div className="animate-rise rounded-xl border border-primary/30 bg-accent p-4 text-sm">
          <p className="font-medium text-accent-foreground">Copy your new key now. It will not be shown again.</p>
          <code className="mt-2 block select-all break-all rounded-lg bg-card px-3 py-2 font-mono text-xs">{secret}</code>
          <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => setSecret(undefined)}>I've saved it</Button>
        </div>
      )}
      <Table>
        <THead><TR><TH>Name</TH><TH>Key</TH><TH>Scopes</TH><TH>Last used</TH><TH>Created</TH>{canManage && <TH></TH>}</TR></THead>
        <TBody>
          {keys.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={canManage ? 6 : 5}>
                <EmptyCell icon={KeyRound} title="No API keys yet" description="Create one per integration so you can revoke a single tool without breaking the rest." />
              </TD>
            </TR>
          )}
          {keys.map((k) => (
            <TR key={k.id} className={k.revokedAt ? "text-muted-foreground" : ""}>
              <TD className="font-medium">{k.name}{k.revokedAt && <Badge variant="muted" className="ml-2">revoked</Badge>}</TD>
              <TD className="font-mono text-xs">{k.prefix}…</TD>
              <TD className="space-x-1">{k.scopes.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</TD>
              <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{fmt(k.lastUsedAt)}</TD>
              <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{fmt(k.createdAt)}</TD>
              {canManage && <TD className="text-right">{!k.revokedAt && <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => { if (window.confirm(`Revoke "${k.name}"? Requests with it stop working immediately.`)) start(async () => { const r = await revokeApiKeyAction(k.id); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); }); }}>Revoke</Button>}</TD>}
            </TR>
          ))}
        </TBody>
      </Table>
      {canManage && (
        <form
          className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const form = e.currentTarget;
            start(async () => {
              const r = await createApiKeyAction(fd);
              setMsg(r.ok ? { success: r.message } : { error: r.error });
              if (r.ok) { setSecret(r.secret); form.reset(); router.refresh(); }
            });
          }}
        >
          <div className="min-w-56 flex-1"><Input name="name" required placeholder="Key name, e.g. Zapier" aria-label="Key name" /></div>
          <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="scopes" value="read" defaultChecked className="size-4 accent-[var(--primary)]" /> read</label>
          <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="scopes" value="write" className="size-4 accent-[var(--primary)]" /> write</label>
          <Button type="submit" disabled={pending}>Create key</Button>
        </form>
      )}
      <FormMessage error={msg.error} success={msg.success} />
    </div>
  );
}
