import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarPlus, ChevronRight, Globe, MapPin, Plus } from "lucide-react";
import { listOrgEvents } from "@evnelo/core/services";
import { can } from "@evnelo/core";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth/session";
import { statusVariant } from "@/lib/dashboard";
import { formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateLeaf, EmptyState, Metric, PageHeader } from "@/components/dashboard/page-chrome";

type Row = Awaited<ReturnType<typeof listOrgEvents>>[number];

export default async function EventsPage() {
  const { org, role } = await requireOrg(undefined, "/dashboard");
  if (!can(role, "view_events")) redirect(can(role, "check_in") ? "/dashboard/checkin" : "/dashboard/no-access");
  const [rows, t] = await Promise.all([listOrgEvents(db, org.id), getTranslations("dashboard")]);
  const now = Date.now();

  // listOrgEvents comes back newest-first; upcoming reads better soonest-first
  const drafts = rows.filter((r) => r.event.status === "draft");
  const upcoming = rows.filter((r) => r.event.status !== "draft" && r.event.endsAt.getTime() >= now).reverse();
  const past = rows.filter((r) => r.event.status !== "draft" && r.event.endsAt.getTime() < now);
  const groups = [
    { key: "upcoming", title: t("events.groups.upcoming"), rows: upcoming },
    { key: "drafts", title: t("events.groups.drafts"), rows: drafts },
    { key: "past", title: t("events.groups.past"), rows: past },
  ].filter((g) => g.rows.length > 0);

  return (
    <div>
      <PageHeader
        title={t("events.title")}
        description={t("events.description", { org: org.name })}
        actions={can(role, "edit_events") && <Button asChild><Link href="/dashboard/events/new"><Plus className="size-4" /> {t("events.newEvent")}</Link></Button>}
      />

      {rows.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={CalendarPlus}
          title={t("events.empty.title")}
          description={t("events.empty.description")}
          action={can(role, "edit_events") ? <Button asChild><Link href="/dashboard/events/new"><Plus className="size-4" /> {t("events.empty.action")}</Link></Button> : undefined}
        />
      ) : (
        <div className="mt-8 space-y-10">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="flex items-baseline gap-3">
                <h2 className="eyebrow">{group.title}</h2>
                <span className="text-xs tabular-nums text-muted-foreground">{group.rows.length}</span>
                <span className="hairline mb-1 flex-1" />
              </div>
              <ul className="mt-3 space-y-2.5">
                {group.rows.map((row, i) => (
                  <li key={row.event.id} className="animate-rise" style={{ ["--stagger" as string]: Math.min(i, 12) }}>
                    <EventRow row={row} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

async function EventRow({ row }: { row: Row }) {
  const [t, locale] = await Promise.all([getTranslations("dashboard"), getLocale()]);
  const { event: e, registrations, pending, revenue, checkedIn } = row;
  const time = new Intl.DateTimeFormat(locale, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: e.timezone }).format(e.startsAt);
  const year = new Intl.DateTimeFormat(locale, { year: "numeric", timeZone: e.timezone }).format(e.startsAt);
  const thisYear = year === new Intl.DateTimeFormat(locale, { year: "numeric" }).format(new Date());
  const place = e.locationType === "online" ? t("events.row.online") : e.city ?? e.venueName ?? t("events.row.inPerson");
  const PlaceIcon = e.locationType === "online" ? Globe : MapPin;

  return (
    <Link
      href={`/dashboard/events/${e.id}`}
      className="press lift block rounded-xl border border-border/80 bg-card p-4 shadow-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25 sm:p-5"
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <DateLeaf date={e.startsAt} timezone={e.timezone} locale={locale} className="shrink-0" />
        <div className="min-w-0 flex-1 basis-52">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate font-display text-lg leading-tight">{e.name}</h3>
            <Badge variant={statusVariant[e.status]} className="shrink-0">{t(`status.event.${e.status}`)}</Badge>
          </div>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-sm text-muted-foreground">
            <span className="tabular-nums">{time}{thisYear ? "" : `, ${year}`}</span>
            <span aria-hidden>·</span>
            <PlaceIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{place}</span>
          </p>
        </div>
        <div className="hairline grid w-full grid-cols-3 gap-3 pt-3 sm:w-auto sm:shrink-0 sm:border-t-0 sm:pt-0">
          <Metric label={t("events.row.registered")} value={registrations} sub={pending > 0 ? t("events.row.pending", { count: pending }) : undefined} className="sm:w-24 sm:text-end" />
          <Metric label={t("events.row.revenue")} value={revenue > 0 ? formatMoney(revenue, "USD", locale) : "—"} className="sm:w-28 sm:text-end" />
          <Metric label={t("events.row.checkedIn")} value={checkedIn} className="sm:w-24 sm:text-end" />
        </div>
        <ChevronRight className="hidden size-4 shrink-0 self-center text-muted-foreground rtl:-scale-x-100 lg:block" aria-hidden />
      </div>
    </Link>
  );
}
