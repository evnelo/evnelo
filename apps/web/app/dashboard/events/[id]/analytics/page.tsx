import { getLocale, getTranslations } from "next-intl/server";
import { Eye } from "lucide-react";
import { dayRange, eventAnalytics } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/dashboard";
import { Card } from "@/components/ui/card";
import { EmptyCell, StatCard } from "@/components/dashboard/page-chrome";
import { SeriesChart } from "@/components/dashboard/series-chart";
import { PeriodPills, parsePeriod } from "@/components/dashboard/period-pills";
import { BreakdownTable, EmailHealth, Funnel, pct } from "@/components/dashboard/analytics-blocks";

/**
 * The event's Analytics tab: first-party traffic (app/api/visit), the view → form → ticket funnel,
 * where visitors came from, and email health. Nothing here needs a third-party script.
 */
export default async function EventAnalyticsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string }> }) {
  const [{ id }, { days }] = await Promise.all([params, searchParams]);
  const period = parsePeriod(days);
  await requireEvent(id);
  const [report, t, locale] = await Promise.all([eventAnalytics(db, id, dayRange(period)), getTranslations("dashboard.analytics"), getLocale()]);
  const region = new Intl.DisplayNames([locale], { type: "region" });
  const cards = [
    { label: t("cards.visitors"), value: report.visitors.toLocaleString(locale), sub: t("cards.views", { count: report.views }) },
    { label: t("cards.registrationRate"), value: `${pct(report.registered, report.visitors)}%`, sub: t("cards.registeredCount", { count: report.registered }) },
    { label: t("cards.openedRate"), value: `${pct(report.opened, report.visitors)}%`, sub: t("cards.openedCount", { count: report.opened }) },
    { label: t("cards.bounceRate"), value: `${pct(report.bounces, report.visitors)}%`, sub: t("cards.bounceHint") },
  ];
  const peakDay = Math.max(0, ...report.byDay.map((d) => d.visitors));

  return (
    <div className="space-y-6">
      <PeriodPills href={`/dashboard/events/${id}/analytics`} days={period} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => <div key={c.label} className="animate-rise" style={{ ["--stagger" as string]: i }}><StatCard {...c} /></div>)}
      </div>

      {report.visitors === 0 ? (
        <Card className="p-5"><EmptyCell icon={Eye} title={t("empty.title")} description={t("empty.description")} /></Card>
      ) : (
        <>
          <Card className="p-5">
            <p className="eyebrow">{t("funnel.title")}</p>
            <div className="mt-4">
              <Funnel steps={[{ label: t("funnel.visitors"), count: report.visitors }, { label: t("funnel.opened"), count: report.opened }, { label: t("funnel.registered"), count: report.registered }]} />
            </div>
          </Card>

          <Card className="p-5">
            <p className="eyebrow">{t("byDay")}</p>
            <div className="mt-4">
              <SeriesChart
                data={report.byDay.map((d) => ({ key: d.day, count: d.visitors }))}
                peak={t("chart.peak", { max: peakDay })}
                summary={t("chart.summary", { total: report.visitors, days: report.byDay.length })}
                aria={t("chart.aria", { max: peakDay, total: report.visitors })}
                tooltip={(date, count) => t("chart.tooltip", { date, count })}
              />
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <p className="eyebrow">{t("sources.title")}</p>
              <BreakdownTable
                columns={[t("sources.source"), t("sources.visitors"), t("sources.registered")]}
                rows={report.sources.map((s) => [s.host ?? t("sources.direct"), s.visitors, s.registered])}
                empty={t("sources.empty")}
              />
            </Card>
            <Card className="p-5">
              <p className="eyebrow">{t("campaigns.title")}</p>
              <BreakdownTable
                columns={[t("campaigns.campaign"), t("sources.visitors"), t("sources.registered")]}
                rows={report.campaigns.map((c) => [[c.source, c.medium, c.campaign].filter(Boolean).join(" / "), c.visitors, c.registered])}
                empty={t("campaigns.empty")}
              />
            </Card>
            <Card className="p-5">
              <p className="eyebrow">{t("audience.countries")}</p>
              <BreakdownTable
                columns={[t("audience.country"), t("sources.visitors")]}
                rows={report.countries.map((c) => [region.of(c.country) ?? c.country, c.visitors])}
                empty={t("audience.empty")}
              />
            </Card>
            <Card className="p-5">
              <p className="eyebrow">{t("audience.devices")}</p>
              <BreakdownTable
                columns={[t("audience.device"), t("sources.visitors")]}
                rows={report.devices.map((d) => [t(`audience.${d.device}`), d.visitors])}
                empty={t("audience.empty")}
              />
            </Card>
          </div>
        </>
      )}

      <EmailHealth email={report.email} />
    </div>
  );
}
