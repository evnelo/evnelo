"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/form-field";
import { SectionTray } from "@/components/dashboard/page-chrome";
import { deleteOrganizationAction } from "@/app/dashboard/actions";

export function DangerZone({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const t = useTranslations("dashboard");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <SectionTray
      tone="destructive"
      title={t("settings.danger.title")}
      description={t("settings.danger.description")}
      actions={<Button asChild variant="outline"><a href="/dashboard/settings/export"><Download className="size-4" /> {t("settings.danger.download")}</a></Button>}
    >
      {isOwner ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-card"
          action={(fd) => start(async () => { const r = await deleteOrganizationAction(fd); if (r && !r.ok) setError(r.error); })}
        >
          <div className="min-w-56 flex-1">
            <Field label={t("settings.danger.confirmLabel", { slug })} htmlFor="del-confirm"><Input id="del-confirm" name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" placeholder={slug} /></Field>
          </div>
          <Button type="submit" variant="destructive" pending={pending} disabled={confirm !== slug}>{t("settings.danger.delete")}</Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{t("settings.danger.ownerOnly")}</p>
      )}
      <div className="mt-3"><FormMessage error={error} /></div>
    </SectionTray>
  );
}
