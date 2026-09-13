import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, ScanLine } from "lucide-react";
import { listOrgEvents } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/utils";
import { DateLeaf, EmptyState, PageHeader } from "@/components/dashboard/page-chrome";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return { title: t("meta.checkin") };
}

/** Events this organization can check people into. The only dashboard page check-in staff can see. */
export default async function CheckInIndexPage() {
  const { org } = await requireOrg("check_in", "/dashboard/checkin");
  const [rows, t, locale] = await Promise.all([
    listOrgEvents(db, org.id, "published").then((list) => list.filter((r) => r.event.endsAt.getTime() > Date.now() - 24 * 3600_000)),
    getTranslations("dashboard"),
    getLocale(),
  ]);
  return (
    <div>
      <PageHeader title={t("checkin.title")} description={t("checkin.description", { org: org.name })} />
      {rows.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={ScanLine}
          title={t("checkin.empty.title")}
          description={t("checkin.empty.description")}
        />
      ) : (
        <ul className="mt-8 space-y-2.5">
          {rows.map(({ event, registrations, checkedIn }, i) => (
            <li key={event.id} className="animate-rise" style={{ ["--stagger" as string]: Math.min(i, 12) }}>
              <Link
                href={`/dashboard/checkin/${event.id}`}
                className="press lift flex min-h-[4.5rem] items-center gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
              >
                <DateLeaf date={event.startsAt} timezone={event.timezone} locale={locale} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg leading-tight">{event.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{formatDateRange(event.startsAt, event.endsAt, event.timezone, locale)}</p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="eyebrow">{t("checkin.in")}</p>
                  <p className="font-display text-lg tabular-nums leading-tight">{checkedIn} / {registrations}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
