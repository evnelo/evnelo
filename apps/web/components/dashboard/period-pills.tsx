import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PeriodDays = 7 | 30 | 90 | null;
const PERIODS: PeriodDays[] = [7, 30, 90, null];

/** `?days=` → a period; 30 days unless told otherwise, `all` for everything. */
export function parsePeriod(value: string | string[] | undefined): PeriodDays {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "7" ? 7 : v === "90" ? 90 : v === "all" ? null : 30;
}

/** The period switch on the analytics pages: plain links, so each period has a URL. */
export async function PeriodPills({ href, days }: { href: string; days: PeriodDays }) {
  const t = await getTranslations("dashboard.analytics.period");
  return (
    <nav aria-label={t("label")} className="flex flex-wrap gap-1.5">
      {PERIODS.map((p) => {
        const key = p === null ? "all" : String(p);
        const active = p === days;
        return (
          <Link key={key} href={`${href}?days=${key}`} scroll={false} aria-current={active ? "page" : undefined} className={cn(buttonVariants({ variant: active ? "default" : "outline", size: "pill" }), "h-8 px-3 text-xs")}>
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
