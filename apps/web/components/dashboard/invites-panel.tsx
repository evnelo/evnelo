"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Copy, Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyCell, Note, PanelHeader } from "@/components/dashboard/page-chrome";
import { createEventInviteAction, deleteEventInviteAction } from "@/app/dashboard/actions";

export type InviteRow = { id: string; token: string; email: string | null; maxUses: number; uses: number; expiresAt: string | null; createdAt: string };

const fmt = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
const status = (i: InviteRow): "expired" | "usedUp" | "active" => (i.expiresAt && new Date(i.expiresAt) <= new Date() ? "expired" : i.uses >= i.maxUses ? "usedUp" : "active");
const isVisibility = (v: string): v is "public" | "unlisted" | "private" => v === "public" || v === "unlisted" || v === "private";

export function InvitesPanel({ eventId, invites, editable, visibility, appUrl }: { eventId: string; invites: InviteRow[]; editable: boolean; visibility: string; appUrl: string }) {
  const t = useTranslations("manage");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [created, setCreated] = useState<string>();
  const [copied, setCopied] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();

  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(undefined), 1500); } catch { window.prompt(t("invites.copyPrompt"), url); }
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        title={t("invites.title")}
        description={t("invites.description")}
      />
      <Note tone={visibility === "private" ? "muted" : "warning"}>
        {visibility === "private"
          ? t("invites.privateNote")
          : t.rich("invites.publicNote", { b: (chunks) => <strong>{chunks}</strong>, visibility: isVisibility(visibility) ? t(`invites.visibility.${visibility}`) : visibility })}
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
            <Field label={tc("labels.email")} htmlFor="inv-email"><Input id="inv-email" name="email" type="email" placeholder={t("invites.form.emailPlaceholder")} /></Field>
            <Field label={t("invites.form.maxUses")} htmlFor="inv-max"><Input id="inv-max" name="maxUses" type="number" min={1} max={10000} defaultValue={1} /></Field>
            <Field label={t("invites.form.expiresInDays")} htmlFor="inv-exp"><Input id="inv-exp" name="expiresInDays" type="number" min={1} max={365} placeholder={t("invites.form.never")} /></Field>
            <Button type="submit" pending={pending}><Plus className="size-4" /> {t("invites.form.create")}</Button>
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">{t("invites.form.help")}</p>
        </form>
      )}
      <FormMessage error={msg.error} success={msg.success} />
      {created && (
        <div className="animate-rise flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-accent px-3 py-2.5 text-sm">
          <span className="eyebrow shrink-0 text-accent-foreground/70">{t("invites.newLink")}</span>
          <code className="min-w-0 flex-1 truncate font-mono text-xs">{created}</code>
          <Button size="sm" variant="outline" onClick={() => copy(created)}>{copied === created ? <Check className="size-4" /> : <Copy className="size-4" />} {t("invites.copyLink")}</Button>
        </div>
      )}

      <Table>
        <THead className="[&_th]:uppercase [&_th]:tracking-[0.12em]"><TR><TH>{t("invites.columns.invite")}</TH><TH>{t("invites.columns.uses")}</TH><TH>{t("invites.columns.expires")}</TH><TH>{tc("labels.status")}</TH><TH className="text-end"></TH></TR></THead>
        <TBody>
          {invites.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={5}>
                <EmptyCell icon={Mail} title={t("invites.empty.title")} description={t("invites.empty.description")} />
              </TD>
            </TR>
          )}
          {invites.map((i) => {
            const url = `${appUrl}/i/${i.token}`;
            const st = status(i);
            return (
              <TR key={i.id}>
                <TD><div className="font-medium">{i.email ?? t("invites.shareableLink")}</div><div className="text-xs text-muted-foreground">{t("invites.created", { date: fmt(i.createdAt, locale) })}</div></TD>
                <TD className="tabular-nums text-muted-foreground">{t("invites.usesOfMax", { uses: i.uses, max: i.maxUses })}</TD>
                <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{i.expiresAt ? fmt(i.expiresAt, locale) : t("invites.never")}</TD>
                <TD><Badge variant={st === "active" ? "success" : "muted"}>{t(`invites.status.${st}`)}</Badge></TD>
                <TD className="text-end">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => copy(url)}>{copied === url ? <Check className="size-4" /> : <Copy className="size-4" />} {tc("actions.copy")}</Button>
                    {editable && <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => { if (window.confirm(t("invites.confirmRevoke"))) start(async () => { const r = await deleteEventInviteAction(eventId, i.id); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); }); }}>{t("invites.revoke")}</Button>}
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
