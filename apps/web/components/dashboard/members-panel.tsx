"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@ot/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormMessage } from "@/components/ui/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { inviteMemberAction, removeMemberAction, revokeInviteAction, setMemberRoleAction } from "@/app/dashboard/actions";

type Member = { userId: string; email: string; name: string | null; role: Role; since: string };
type Invite = { id: string; email: string; role: string; expiresAt: string };

export function MembersPanel({ members, invites, canManage, currentUserId, roleLabels }: { members: Member[]; invites: Invite[]; canManage: boolean; currentUserId: string; roleLabels: Record<Role, string> }) {
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string } | void>) =>
    start(async () => {
      const r = await fn();
      if (r && "ok" in r) setMsg(r.ok ? { success: r.message } : { error: r.error });
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <Table>
        <THead><TR><TH>Member</TH><TH>Role</TH><TH>Since</TH>{canManage && <TH className="text-right"></TH>}</TR></THead>
        <TBody>
          {members.map((m) => (
            <TR key={m.userId}>
              <TD><div className="font-medium">{m.name ?? m.email}</div>{m.name && <div className="text-xs text-muted-foreground">{m.email}</div>}</TD>
              <TD>
                {canManage ? (
                  <div className="w-40"><Select value={m.role} disabled={pending} aria-label="Role" onChange={(e) => run(() => setMemberRoleAction(m.userId, e.target.value as Role))}>{(Object.keys(roleLabels) as Role[]).map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</Select></div>
                ) : roleLabels[m.role]}
              </TD>
              <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{new Date(m.since).toLocaleDateString()}</TD>
              {canManage && <TD className="text-right">{m.userId !== currentUserId && <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => { if (window.confirm(`Remove ${m.email} from the organization?`)) run(() => removeMemberAction(m.userId)); }}>Remove</Button>}</TD>}
            </TR>
          ))}
          {invites.map((i) => (
            <TR key={i.id} className="text-muted-foreground">
              <TD>{i.email}<div className="text-xs">Invited · expires {new Date(i.expiresAt).toLocaleDateString()}</div></TD>
              <TD>{roleLabels[i.role as Role] ?? i.role}</TD>
              <TD>—</TD>
              {canManage && <TD className="text-right"><Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => run(() => revokeInviteAction(i.id))}>Revoke</Button></TD>}
            </TR>
          ))}
        </TBody>
      </Table>
      {canManage && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card p-3 shadow-card"
          onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run(() => inviteMemberAction(fd)); e.currentTarget.reset(); }}
        >
          <div className="min-w-64 flex-1"><Input name="email" type="email" required placeholder="teammate@example.com" aria-label="Email" /></div>
          <div className="w-44"><Select name="role" defaultValue="member" aria-label="Role"><option value="admin">Admin</option><option value="member">Member</option><option value="checkin">Check-in staff</option></Select></div>
          <Button type="submit" disabled={pending}>Send invite</Button>
        </form>
      )}
      <FormMessage error={msg.error} success={msg.success} />
    </div>
  );
}
