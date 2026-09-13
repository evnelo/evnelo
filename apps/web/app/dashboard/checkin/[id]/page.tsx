import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createHash } from "node:crypto";
import { ChevronLeft } from "lucide-react";
import { can } from "@evnelo/core";
import { checkInStats, listCheckInAttendees, recentCheckIns } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { checkInAccess } from "@/lib/checkin-access";
import { formatDateRange } from "@/lib/utils";
import { CheckInScanner } from "@/components/dashboard/check-in-scanner";
import { PageHeader } from "@/components/dashboard/page-chrome";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return { title: t("meta.checkin") };
}

/** Lives outside the event layout so check-in staff (who cannot view the dashboard) can use it. */
export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await checkInAccess(id);
  if (!access.ok) {
    if (access.status === 401) redirect(`/login?next=${encodeURIComponent(`/dashboard/checkin/${id}`)}`);
    notFound();
  }
  const { event, role } = access;
  const [rows, stats, recent, t, locale] = await Promise.all([listCheckInAttendees(db, id), checkInStats(db, id), recentCheckIns(db, id), getTranslations("dashboard"), getLocale()]);
  const initial = {
    generatedAt: new Date().toISOString(), stats, recent: recent.map((r) => ({ ...r, at: r.at.toISOString() })),
    tickets: rows.map((r) => ({ id: r.ticketId, h: createHash("sha256").update(r.token).digest("hex"), n: r.name, e: r.email, t: r.ticketTypeName, g: r.hostName, c: r.checkedInAt?.toISOString() ?? null })),
  };
  return (
    <div>
      <PageHeader
        title={event.name}
        description={formatDateRange(event.startsAt, event.endsAt, event.timezone, locale)}
        above={
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Link href="/dashboard/checkin" className="press -ms-1 inline-flex items-center gap-1 rounded-md py-1 pe-2 hover:text-foreground">
              <ChevronLeft className="size-3.5 rtl:-scale-x-100" aria-hidden /> {t("checkin.event.allCheckin")}
            </Link>
            {can(role, "view_events") && <Link href={`/dashboard/events/${id}`} className="press rounded-md underline decoration-dotted underline-offset-4 hover:text-foreground">{t("checkin.event.eventDashboard")}</Link>}
          </div>
        }
      />
      <div className="mt-6">
        <CheckInScanner eventId={id} initial={initial} />
      </div>
    </div>
  );
}
