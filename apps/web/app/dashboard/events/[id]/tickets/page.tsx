import { listDiscountCodes, listTicketTypes } from "@ot/core/services";
import { can } from "@ot/core";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/dashboard";
import { TicketTypesPanel } from "@/components/dashboard/ticket-types-panel";
import { DiscountCodesPanel } from "@/components/dashboard/discount-codes-panel";

export default async function TicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, event } = await requireEvent(id);
  const [types, codes] = await Promise.all([listTicketTypes(db, id), listDiscountCodes(db, id)]);
  const currency = types[0]?.currency ?? "USD";
  return (
    <div className="space-y-8">
      <TicketTypesPanel
        eventId={id}
        editable={can(role, "edit_events")}
        defaultCurrency={currency}
        guestsEnabled={event.guestsEnabled}
        types={types.map((t) => ({ ...t, salesStartAt: t.salesStartAt?.toISOString() ?? null, salesEndAt: t.salesEndAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() }))}
      />
      <DiscountCodesPanel eventId={id} editable={can(role, "edit_events")} currency={currency} codes={codes.map((c) => ({ id: c.id, code: c.code, kind: c.kind, value: c.value, maxUses: c.maxUses, uses: c.uses, expiresAt: c.expiresAt?.toISOString() ?? null }))} />
    </div>
  );
}
