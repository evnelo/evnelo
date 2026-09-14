import { NextResponse } from "next/server";
import { dayRange, organizationAnalytics, organizationAnalyticsCsv } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth/session";
import { parsePeriod } from "@/components/dashboard/period-pills";
import { EVENTS } from "@/lib/analytics-events";
import { track } from "@/lib/posthog-server";

export const runtime = "nodejs";

/** The analytics page's events table as CSV, for the same period. */
export async function GET(request: Request) {
  const { org, user } = await requireOrg("view_events", "/dashboard/analytics");
  const period = parsePeriod(new URL(request.url).searchParams.get("days") ?? undefined);
  const report = await organizationAnalytics(db, org.id, dayRange(period));
  const csv = report ? organizationAnalyticsCsv(report) : "event,starts_at,status,registrations,visitors,revenue,currency,checked_in\n";
  track(EVENTS.exportDownloaded, { distinctId: user.id, organizationId: org.id, properties: { kind: "analytics_csv", period: period ?? "all" } });
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="evnelo-${org.slug}-analytics-${period ?? "all"}.csv"`, "cache-control": "private, no-store" },
  });
}
