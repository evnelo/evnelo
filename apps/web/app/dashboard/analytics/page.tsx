import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BarChart3, Download } from "lucide-react";
import { dayRange, organizationAnalytics } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth/session";
import { formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyCell, EmptyState, PageHeader, StatCard } from "@/components/dashboard/page-chrome";
import { SeriesChart } from "@/components/dashboard/series-chart";
import { PeriodPills, parsePeriod } from "@/components/dashboard/period-pills";
import { EmailHealth, pct } from "@/components/dashboard/analytics-blocks";

/** The account-wide report: every event's registrations, revenue, traffic and check-ins in one place. */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days } = await searchParams;
  const period = parsePeriod(days);
  const { org } = await requireOrg("view_events", "/dashboard/analytics");
  const [report, t, locale] = await Promise.all([organizationAnalytics(db, org.id, dayRange(period)), getTranslations("dashboard.analytics"), getLocale()]);
  const periodKey = period === null ? "all" : String(period);

  if (!report) {
    return (
      <div>
        <PageHeader title={t("title")} description={t("description", { org: org.name })} />
        <EmptyState className="mt-10" icon={BarChart3} title={t("orgEmpty.title")} description={t("orgEmpty.description")} />
      </div>
    );
  }

  const revenue = report.revenueByMonth.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.currency]: (acc[m.currency] ?? 0) + m.amountMinor }), {});
  const revenueText = Object.entries(revenue).map(([currency, minor]) => formatMoney(minor, currency, locale)).join(" + ") || formatMoney(0, report.topEvents[0]?.currency ?? "USD", locale);
  const mainCurrency = Object.entries(revenue).sort((a, b) => b[1] - a[1])[0]?.[0];
  const cards = [
    { label: t("cards.registrations"), value: report.registrations.toLocaleString(locale), sub: t("cards.eventsHint", { count: report.events }) },
    { label: t("cards.revenue"), value: revenueText, sub: t("cards.revenueHint") },
    { label: t("cards.visitors"), value: report.traffic.visitors.toLocaleString(locale), sub: t("cards.views", { count: report.traffic.views }) },
    { label: t("cards.checkInRate"), value: `${pct(report.doors.checkedIn, report.doors.confirmed)}%`, sub: t("cards.checkInHint", { checkedIn: report.doors.checkedIn, confirmed: report.doors.confirmed }) },
  ];
  const peakDay = Math.max(0, ...report.registrationsByDay.map((d) => d.count));
  const months = report.revenueByMonth.filter((m) => m.currency === mainCurrency);
  const peakMonth = Math.max(0, ...months.map((m) => m.amountMinor));

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description", { org: org.name })}
        actions={<Button asChild variant="outline"><a href={`/dashboard/analytics/export?days=${periodKey}`}><Download className="size-4" /> {t("export")}</a></Button>}
      />
      <div className="mt-6 space-y-6">
        <PeriodPills href="/dashboard/analytics" days={period} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c, i) => <div key={c.label} className="animate-rise" style={{ ["--stagger" as string]: i }}><StatCard {...c} /></div>)}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <p className="eyebrow">{t("registrationsByDay")}</p>
            <div className="mt-4">
              {report.registrationsByDay.length === 0
                ? <EmptyCell icon={BarChart3} title={t("noData.title")} description={t("noData.registrations")} />
                : <SeriesChart data={report.registrationsByDay.map((d) => ({ key: d.day, count: d.count }))} peak={t("chart.peak", { max: peakDay })} summary={t("chart.summary", { total: report.registrations, days: report.registrationsByDay.length })} aria={t("chart.aria", { max: peakDay, total: report.registrations })} tooltip={(date, count) => t("chart.tooltip", { date, count })} />}
            </div>
          </Card>
          <Card className="p-5">
            <p className="eyebrow">{t("revenueByMonth")}</p>
            <div className="mt-4">
              {months.length === 0 || !mainCurrency
                ? <EmptyCell icon={BarChart3} title={t("noData.title")} description={t("noData.revenue")} />
                : <SeriesChart unit="month" data={months.map((m) => ({ key: m.month, count: m.amountMinor }))} peak={t("chart.peakMonth", { max: formatMoney(peakMonth, mainCurrency, locale) })} summary={t("chart.monthsSummary", { total: formatMoney(months.reduce((a, m) => a + m.amountMinor, 0), mainCurrency, locale), months: months.length })} aria={t("chart.revenueAria")} tooltip={(date, count) => t("chart.tooltip", { date, count: formatMoney(count, mainCurrency, locale) })} />}
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <p className="eyebrow">{t("topEvents.title")}</p>
          {report.topEvents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("noData.title")}</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="pb-2 text-start font-medium">{t("topEvents.event")}</th>
                  <th scope="col" className="pb-2 text-end font-medium">{t("topEvents.registrations")}</th>
                  <th scope="col" className="hidden pb-2 text-end font-medium sm:table-cell">{t("topEvents.visitors")}</th>
                  <th scope="col" className="pb-2 text-end font-medium">{t("topEvents.revenue")}</th>
                  <th scope="col" className="hidden pb-2 text-end font-medium sm:table-cell">{t("topEvents.checkedIn")}</th>
                </tr>
              </thead>
              <tbody>
                {report.topEvents.map((e) => (
                  <tr key={e.id} className="border-t border-border/70">
                    <td className="w-full py-2.5 pe-3"><Link href={`/dashboard/events/${e.id}/analytics?days=${periodKey}`} className="press block max-w-md truncate rounded underline decoration-dotted underline-offset-4 hover:text-primary">{e.name}</Link></td>
                    <td className="py-2.5 text-end tabular-nums">{e.registrations.toLocaleString(locale)}</td>
                    <td className="hidden py-2.5 text-end tabular-nums sm:table-cell">{e.visitors.toLocaleString(locale)}</td>
                    <td className="py-2.5 text-end tabular-nums">{formatMoney(e.revenue, e.currency, locale)}</td>
                    <td className="hidden py-2.5 text-end tabular-nums sm:table-cell">{e.checkedIn.toLocaleString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <EmailHealth email={report.email} />
      </div>
    </div>
  );
}
