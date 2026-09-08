import { z } from "zod";
import type { RegistrationField } from "@ot/db";
import { visibleFieldKeys, type Answers } from "./conditions";

type FieldDef = Pick<RegistrationField, "key" | "label" | "type" | "required" | "options" | "condition" | "position" | "scope" | "ticketTypeIds">;

const E164 = /^\+[1-9]\d{6,14}$/;

function fieldSchema(f: FieldDef): z.ZodTypeAny {
  const optionValues = (f.options ?? []).map((o) => o.value) as [string, ...string[]];
  let s: z.ZodTypeAny;
  switch (f.type) {
    case "short_text": s = z.string().trim().max(200); break;
    case "long_text": s = z.string().trim().max(5000); break;
    case "email": s = z.string().trim().email(); break;
    case "phone": s = z.string().trim().regex(E164, "Use international format, e.g. +5511999999999"); break;
    case "number": s = z.coerce.number(); break;
    case "url": s = z.string().trim().url(); break;
    case "date": s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/); break;
    case "select": s = optionValues.length ? z.enum(optionValues) : z.string(); break;
    case "multi_select": {
      // checkbox groups arrive as `false` (none checked) or a single string (one ref) from form libraries
      const item = optionValues.length ? z.enum(optionValues) : z.string();
      s = z.preprocess((v) => (v === false || v == null || v === "" ? [] : typeof v === "string" ? [v] : v), z.array(item));
      break;
    }
    case "checkbox": s = z.boolean(); break;
    case "consent": s = z.literal(true, { errorMap: () => ({ message: "Required" }) }); break;
    case "file": s = z.string().url(); break;
  }
  if (f.required) {
    if (f.type === "multi_select") s = s.refine((v) => Array.isArray(v) && v.length > 0, "Choose at least one");
    if (f.type === "checkbox") s = z.literal(true, { errorMap: () => ({ message: "Required" }) });
    if (s instanceof z.ZodString) s = s.min(1, "Required");
    return s;
  }
  return s.optional().or(z.literal("")).or(z.null());
}

/**
 * Builds a zod schema for the answers of one scope (order | attendee | guest) for a given
 * ticket type. Hidden fields (by condition) are stripped and never validated —
 * the server is the source of truth, so this runs on submit as well as in the browser.
 */
export function buildAnswersSchema(
  fields: FieldDef[],
  opts: { scope: RegistrationField["scope"]; ticketTypeId?: string },
) {
  const applicable = fields
    .filter((f) => f.scope === opts.scope)
    .filter((f) => !f.ticketTypeIds || !opts.ticketTypeId || f.ticketTypeIds.includes(opts.ticketTypeId))
    .sort((a, b) => a.position - b.position);

  return z.record(z.unknown()).transform((raw, ctx) => {
    const visible = visibleFieldKeys(applicable, raw as Answers);
    const out: Answers = {};
    for (const f of applicable) {
      if (!visible.has(f.key)) continue;
      const r = fieldSchema(f).safeParse(raw[f.key]);
      if (!r.success) {
        for (const issue of r.error.issues) ctx.addIssue({ ...issue, path: [f.key, ...issue.path] });
        continue;
      }
      const empty = r.data === undefined || r.data === "" || r.data === null || (Array.isArray(r.data) && r.data.length === 0);
      if (!empty) out[f.key] = r.data;
    }
    return out;
  });
}
