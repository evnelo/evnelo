import Link from "next/link";
import { listOrgEvents } from "@ot/core/services";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/utils";

export const metadata = { title: "Check-in" };

/** Events this organization can check people into. The only dashboard page check-in staff can see. */
export default async function CheckInIndexPage() {
  const { org } = await requireOrg("check_in", "/dashboard/checkin");
  const rows = (await listOrgEvents(db, org.id, "published")).filter((r) => r.event.endsAt.getTime() > Date.now() - 24 * 3600_000);
  return (
    <div>
      <h1 className="display text-3xl">Check-in</h1>
      <p className="mt-1 text-sm text-muted-foreground">{org.name}. Open an event on the phone at the door; scanning needs camera access.</p>
      <ul className="mt-6 divide-y rounded-lg border">
        {rows.length === 0 && <li className="p-4 text-sm text-muted-foreground">No published upcoming events.</li>}
        {rows.map(({ event, registrations, checkedIn }) => (
          <li key={event.id}>
            <Link href={`/dashboard/checkin/${event.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50">
              <div className="min-w-0">
                <p className="truncate font-medium">{event.name}</p>
                <p className="text-xs text-muted-foreground">{formatDateRange(event.startsAt, event.endsAt, event.timezone)}</p>
              </div>
              <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{checkedIn} / {registrations} in</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
