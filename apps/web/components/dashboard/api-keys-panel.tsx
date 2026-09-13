"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [secret, setSecret] = useState<string>();
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale) : t("settings.developer.apiKeys.never"));

  return (
    <div className="space-y-4">
      <Note>
        {t.rich("settings.developer.apiKeys.note", {
          header: "Authorization: Bearer ev_live_…",
          docs: (chunks) => <a href={docsUrl} className="underline decoration-dotted underline-offset-4">{chunks}</a>,
          code: (chunks) => <code className="rounded bg-card px-1 text-xs">{chunks}</code>,
        })}
      </Note>
      {secret && (
        <div className="animate-rise rounded-xl border border-primary/30 bg-accent p-4 text-sm">
          <p className="font-medium text-accent-foreground">{t("settings.developer.apiKeys.newKey")}</p>
          <code className="mt-2 block select-all break-all rounded-lg bg-card px-3 py-2 font-mono text-xs">{secret}</code>
          <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => setSecret(undefined)}>{t("settings.developer.apiKeys.saved")}</Button>
        </div>
      )}
      <Table>
        <THead className="[&_th]:uppercase [&_th]:tracking-[0.12em]"><TR><TH>{tc("labels.name")}</TH><TH>{t("settings.developer.apiKeys.columns.key")}</TH><TH>{t("settings.developer.apiKeys.columns.scopes")}</TH><TH>{t("settings.developer.apiKeys.columns.lastUsed")}</TH><TH>{tc("labels.created")}</TH>{canManage && <TH></TH>}</TR></THead>
        <TBody>
          {keys.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={canManage ? 6 : 5}>
                <EmptyCell icon={KeyRound} title={t("settings.developer.apiKeys.empty.title")} description={t("settings.developer.apiKeys.empty.description")} />
              </TD>
            </TR>
          )}
          {keys.map((k) => (
            <TR key={k.id} className={k.revokedAt ? "text-muted-foreground" : ""}>
              <TD className="font-medium">{k.name}{k.revokedAt && <Badge variant="muted" className="ms-2">{t("settings.developer.apiKeys.revoked")}</Badge>}</TD>
              <TD className="font-mono text-xs">{k.prefix}…</TD>
              <TD className="space-x-1 rtl:space-x-reverse">{k.scopes.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</TD>
              <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{fmt(k.lastUsedAt)}</TD>
              <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{fmt(k.createdAt)}</TD>
              {canManage && <TD className="text-end">{!k.revokedAt && <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => { if (window.confirm(t("settings.developer.apiKeys.revokeConfirm", { name: k.name }))) start(async () => { const r = await revokeApiKeyAction(k.id); setMsg(r.ok ? {} : { error: r.error }); router.refresh(); }); }}>{t("settings.developer.apiKeys.revoke")}</Button>}</TD>}
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
          <div className="min-w-56 flex-1"><Input name="name" required placeholder={t("settings.developer.apiKeys.namePlaceholder")} aria-label={t("settings.developer.apiKeys.nameLabel")} /></div>
          <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="scopes" value="read" defaultChecked className="size-4 accent-[var(--primary)]" /> {t("settings.developer.apiKeys.scopeRead")}</label>
          <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="scopes" value="write" className="size-4 accent-[var(--primary)]" /> {t("settings.developer.apiKeys.scopeWrite")}</label>
          <Button type="submit" pending={pending}>{t("settings.developer.apiKeys.create")}</Button>
        </form>
      )}
      <FormMessage error={msg.error} success={msg.success} />
    </div>
  );
}
