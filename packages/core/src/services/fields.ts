import { and, asc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { registrationFields, type ConditionGroup, type Database, type FieldOption } from "@ot/db";
import { validateConditions } from "../fields/conditions";
import { newId } from "../ids";

import { FIELD_TYPES } from "../constants";

const conditionInput = z.object({
  op: z.enum(["and", "or"]),
  rules: z.array(z.object({ fieldKey: z.string().min(1), op: z.enum(["eq", "neq", "contains", "empty", "not_empty"]), value: z.string().optional() })).min(1).max(5),
});

export const registrationFieldInput = z.object({
  id: z.string().length(26).optional(),
  key: z.string().trim().regex(/^[a-z0-9_]{1,60}$/, "Lowercase letters, numbers and underscores"),
  label: z.string().trim().min(1).max(160),
  helpText: z.string().trim().max(300).transform((v) => v || null).nullable().optional(),
  placeholder: z.string().trim().max(120).transform((v) => v || null).nullable().optional(),
  type: z.enum(FIELD_TYPES),
  options: z.array(z.object({ value: z.string().trim().min(1).max(100), label: z.string().trim().min(1).max(160) })).max(50).nullable().optional(),
  required: z.boolean().default(false),
  scope: z.enum(["order", "attendee", "guest"]).default("attendee"),
  ticketTypeIds: z.array(z.string().length(26)).nullable().optional(), // null/empty = all ticket types
  condition: conditionInput.nullable().optional(),
});
export type RegistrationFieldInput = z.infer<typeof registrationFieldInput>;
export const registrationFieldsInput = z.array(registrationFieldInput).max(60);

export async function listRegistrationFields(db: Database, eventId: string) {
  return db.select().from(registrationFields).where(eq(registrationFields.eventId, eventId)).orderBy(asc(registrationFields.position));
}

/**
 * Replace the event's form with `fields` (order = position). Existing rows are matched by id
 * so answers keyed by `key` stay attached; conditions are validated builder-side first.
 */
export async function saveRegistrationFields(db: Database, eventId: string, fields: RegistrationFieldInput[]) {
  const keys = fields.map((f) => f.key);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupes.length) throw new Error(`Duplicate field keys: ${[...new Set(dupes)].join(", ")}`);
  for (const f of fields) {
    if ((f.type === "select" || f.type === "multi_select") && !(f.options?.length)) throw new Error(`"${f.label}" needs at least one option.`);
    for (const r of f.condition?.rules ?? []) {
      const target = fields.find((x) => x.key === r.fieldKey);
      if (target && target.scope !== f.scope) throw new Error(`"${f.label}" can only depend on fields in the same section (${f.scope}).`);
    }
  }
  const check = validateConditions(fields.map((f, i) => ({ key: f.key, condition: f.condition ?? null, position: i })));
  if (!check.ok) throw new Error(check.errors.join(" "));

  await db.transaction(async (tx) => {
    const keepIds = fields.map((f) => f.id).filter((id): id is string => !!id);
    if (keepIds.length) await tx.delete(registrationFields).where(and(eq(registrationFields.eventId, eventId), notInArray(registrationFields.id, keepIds)));
    else await tx.delete(registrationFields).where(eq(registrationFields.eventId, eventId));
    for (const [i, f] of fields.entries()) {
      const values = {
        key: f.key, label: f.label, helpText: f.helpText ?? null, placeholder: f.placeholder ?? null, type: f.type,
        options: (f.type === "select" || f.type === "multi_select" ? f.options : null) as FieldOption[] | null,
        required: f.required, scope: f.scope, ticketTypeIds: f.ticketTypeIds?.length ? f.ticketTypeIds : null,
        condition: (f.condition ?? null) as ConditionGroup | null, position: i,
      };
      if (f.id) await tx.update(registrationFields).set(values).where(and(eq(registrationFields.id, f.id), eq(registrationFields.eventId, eventId)));
      else await tx.insert(registrationFields).values({ id: newId(), eventId, ...values });
    }
  });
  return listRegistrationFields(db, eventId);
}
