import { listWaitlist, promotableTicketTypes, waitlistStatus } from "@evnelo/core/services";
import { can } from "@evnelo/core";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/dashboard";
import { WaitlistPanel } from "@/components/dashboard/waitlist-panel";

export default async function WaitlistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, event } = await requireEvent(id);
  const [rows, types] = await Promise.all([listWaitlist(db, id), promotableTicketTypes(db, id)]);
  return (
    <WaitlistPanel
      eventId={id}
      editable={can(role, "manage_attendees")}
      waitlistEnabled={event.waitlistEnabled}
      ticketTypes={types}
      entries={rows.map(({ entry, ticketTypeName }) => ({
        id: entry.id, name: entry.name, email: entry.email, status: waitlistStatus(entry), ticketTypeName, createdAt: entry.createdAt.toISOString(), holdExpiresAt: entry.holdExpiresAt?.toISOString() ?? null,
      }))}
    />
  );
}
