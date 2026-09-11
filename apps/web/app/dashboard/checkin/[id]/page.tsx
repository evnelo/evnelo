import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { ChevronLeft } from "lucide-react";
import { can } from "@ot/core";
import { checkInStats, listCheckInAttendees, recentCheckIns } from "@ot/core/services";
import { db } from "@/lib/db";
import { checkInAccess } from "@/lib/checkin-access";
import { formatDateRange } from "@/lib/utils";
import { CheckInScanner } from "@/components/dashboard/check-in-scanner";
import { PageHeader } from "@/components/dashboard/page-chrome";

export const metadata = { title: "Check-in" };

/** Lives outside the event layout so check-in staff (who cannot view the dashboard) can use it. */
export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await checkInAccess(id);
  if (!access.ok) {
    if (access.status === 401) redirect(`/login?next=${encodeURIComponent(`/dashboard/checkin/${id}`)}`);
    notFound();
  }
  const { event, role } = access;
  const [rows, stats, recent] = await Promise.all([listCheckInAttendees(db, id), checkInStats(db, id), recentCheckIns(db, id)]);
  const initial = {
    generatedAt: new Date().toISOString(), stats, recent: recent.map((r) => ({ ...r, at: r.at.toISOString() })),
    tickets: rows.map((r) => ({ id: r.ticketId, h: createHash("sha256").update(r.token).digest("hex"), n: r.name, e: r.email, t: r.ticketTypeName, g: r.hostName, c: r.checkedInAt?.toISOString() ?? null })),
  };
  return (
    <div>
      <PageHeader
        title={event.name}
        description={formatDateRange(event.startsAt, event.endsAt, event.timezone)}
        above={
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Link href="/dashboard/checkin" className="press -ml-1 inline-flex items-center gap-1 rounded-md py-1 pr-2 hover:text-foreground">
              <ChevronLeft className="size-3.5" aria-hidden /> All check-in
            </Link>
            {can(role, "view_events") && <Link href={`/dashboard/events/${id}`} className="press rounded-md underline decoration-dotted underline-offset-4 hover:text-foreground">Event dashboard</Link>}
          </div>
        }
      />
      <div className="mt-6">
        <CheckInScanner eventId={id} initial={initial} />
      </div>
    </div>
  );
}
