"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Globe, LoaderCircle } from "lucide-react";
import { LOCALES } from "@/i18n/locales";
import { setLocaleAction } from "@/i18n/actions";
import { cn } from "@/lib/utils";

/**
 * Language menu for the top bar: a native select styled as a pill, labelled in each language's
 * own script. Picking one stores the cookie and refreshes the tree; URLs never change.
 */
export function LocaleSwitcher({ className, variant = "pill" }: { className?: string; variant?: "pill" | "plain" }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className={cn("press relative inline-flex h-9 items-center gap-1.5 text-sm", variant === "pill" ? "rounded-full px-3 hover:bg-muted/80" : "rounded-md px-2 text-muted-foreground hover:text-foreground", pending && "opacity-70", className)}>
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Globe className="size-4" aria-hidden />}
      <span className="sr-only">{t("language")}</span>
      <select
        aria-label={t("language")}
        value={locale}
        disabled={pending}
        onChange={(e) => { const next = e.target.value; start(async () => { await setLocaleAction(next); router.refresh(); }); }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LOCALES.map((l) => <option key={l.code} value={l.code} lang={l.code} dir={l.dir}>{l.name}</option>)}
      </select>
      <span aria-hidden className="uppercase tabular-nums">{locale.split("-")[0]}</span>
    </label>
  );
}
