import { listRegistrationFields, listTicketTypes } from "@ot/core/services";
import { can } from "@ot/core";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/dashboard";
import { storageConfigured } from "@/lib/storage";
import { FieldsBuilder } from "@/components/dashboard/fields-builder";

export default async function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, event } = await requireEvent(id);
  const [fields, types] = await Promise.all([listRegistrationFields(db, id), listTicketTypes(db, id)]);
  return (
    <FieldsBuilder
      eventId={id}
      editable={can(role, "edit_events")}
      guestsEnabled={event.guestsEnabled}
      filesEnabled={storageConfigured}
      ticketTypes={types.map((t) => ({ id: t.id, name: t.name }))}
      initial={fields.map((f) => ({
        id: f.id, key: f.key, label: f.label, helpText: f.helpText ?? "", placeholder: f.placeholder ?? "", type: f.type,
        options: f.options ?? [], required: f.required, scope: f.scope, ticketTypeIds: f.ticketTypeIds ?? [], condition: f.condition ?? null,
      }))}
    />
  );
}
