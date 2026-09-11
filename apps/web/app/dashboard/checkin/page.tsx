import Link from "next/link";
import { ChevronRight, ScanLine } from "lucide-react";
import { listOrgEvents } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/utils";
import { DateLeaf, EmptyState, PageHeader } from "@/components/dashboard/page-chrome";

export const metadata = { title: "Check-in" };

/** Events this organization can check people into. The only dashboard page check-in staff can see. */
export default async function CheckInIndexPage() {
  const { org } = await requireOrg("check_in", "/dashboard/checkin");
  const rows = (await listOrgEvents(db, org.id, "published")).filter((r) => r.event.endsAt.getTime() > Date.now() - 24 * 3600_000);
  return (
    <div>
      <PageHeader title="Check-in" description={`${org.name}. Open an event on the phone at the door; scanning needs camera access.`} />
      {rows.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={ScanLine}
          title="Nothing to scan today"
          description="Published events appear here from the moment they go live until a day after they end."
        />
      ) : (
        <ul className="mt-8 space-y-2.5">
          {rows.map(({ event, registrations, checkedIn }, i) => (
            <li key={event.id} className="animate-rise" style={{ ["--stagger" as string]: Math.min(i, 12) }}>
              <Link
                href={`/dashboard/checkin/${event.id}`}
                className="press lift flex min-h-[4.5rem] items-center gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
              >
                <DateLeaf date={event.startsAt} timezone={event.timezone} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg leading-tight">{event.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{formatDateRange(event.startsAt, event.endsAt, event.timezone)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="eyebrow">In</p>
                  <p className="font-display text-lg tabular-nums leading-tight">{checkedIn} / {registrations}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
