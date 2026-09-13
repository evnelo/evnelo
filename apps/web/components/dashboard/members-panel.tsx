"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { Role } from "@evnelo/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormMessage } from "@/components/ui/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { inviteMemberAction, removeMemberAction, revokeInviteAction, setMemberRoleAction } from "@/app/dashboard/actions";

type Member = { userId: string; email: string; name: string | null; role: Role; since: string };
type Invite = { id: string; email: string; role: string; expiresAt: string };

/** `roleLabels` is built by the page with the viewer's translations, one label per role. */
export function MembersPanel({ members, invites, canManage, currentUserId, roleLabels }: { members: Member[]; invites: Invite[]; canManage: boolean; currentUserId: string; roleLabels: Record<Role, string> }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string } | void>) =>
    start(async () => {
      const r = await fn();
      if (r && "ok" in r) setMsg(r.ok ? { success: r.message } : { error: r.error });
      router.refresh();
    });
  const invitable: Exclude<Role, "owner">[] = ["admin", "member", "checkin"];

  return (
    <div className="space-y-4">
      <Table>
        <THead className="[&_th]:uppercase [&_th]:tracking-[0.12em]"><TR><TH>{t("settings.members.columns.member")}</TH><TH>{t("settings.members.columns.role")}</TH><TH>{t("settings.members.columns.since")}</TH>{canManage && <TH className="text-end"></TH>}</TR></THead>
        <TBody>
          {members.map((m) => (
            <TR key={m.userId}>
              <TD><div className="font-medium">{m.name ?? m.email}</div>{m.name && <div className="text-xs text-muted-foreground">{m.email}</div>}</TD>
              <TD>
                {canManage ? (
                  <div className="w-40"><Select value={m.role} disabled={pending} aria-label={t("settings.members.columns.role")} onChange={(e) => run(() => setMemberRoleAction(m.userId, e.target.value as Role))}>{(Object.keys(roleLabels) as Role[]).map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</Select></div>
                ) : roleLabels[m.role]}
              </TD>
              <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{new Date(m.since).toLocaleDateString(locale)}</TD>
              {canManage && <TD className="text-end">{m.userId !== currentUserId && <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => { if (window.confirm(t("settings.members.removeConfirm", { email: m.email }))) run(() => removeMemberAction(m.userId)); }}>{tc("actions.remove")}</Button>}</TD>}
            </TR>
          ))}
          {invites.map((i) => (
            <TR key={i.id} className="text-muted-foreground">
              <TD>{i.email}<div className="text-xs">{t("settings.members.invited", { date: new Date(i.expiresAt).toLocaleDateString(locale) })}</div></TD>
              <TD>{roleLabels[i.role as Role] ?? i.role}</TD>
              <TD>—</TD>
              {canManage && <TD className="text-end"><Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => run(() => revokeInviteAction(i.id))}>{t("settings.members.revoke")}</Button></TD>}
            </TR>
          ))}
        </TBody>
      </Table>
      {canManage && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card p-3 shadow-card"
          onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run(() => inviteMemberAction(fd)); e.currentTarget.reset(); }}
        >
          <div className="min-w-64 flex-1"><Input name="email" type="email" required placeholder={t("settings.members.emailPlaceholder")} aria-label={tc("labels.email")} /></div>
          <div className="w-44"><Select name="role" defaultValue="member" aria-label={t("settings.members.columns.role")}>{invitable.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</Select></div>
          <Button type="submit" pending={pending}>{t("settings.members.sendInvite")}</Button>
        </form>
      )}
      <FormMessage error={msg.error} success={msg.success} />
    </div>
  );
}
