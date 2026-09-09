import { listTicketTypes } from "@ot/core/services";
import { can } from "@ot/core";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/dashboard";
import { TicketTypesPanel } from "@/components/dashboard/ticket-types-panel";

export default async function TicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, event } = await requireEvent(id);
  const types = await listTicketTypes(db, id);
  return (
    <TicketTypesPanel
      eventId={id}
      editable={can(role, "edit_events")}
      defaultCurrency={types[0]?.currency ?? "USD"}
      guestsEnabled={event.guestsEnabled}
      types={types.map((t) => ({ ...t, salesStartAt: t.salesStartAt?.toISOString() ?? null, salesEndAt: t.salesEndAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() }))}
    />
  );
}
