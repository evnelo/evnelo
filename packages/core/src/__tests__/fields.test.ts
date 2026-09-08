import { describe, expect, it } from "vitest";
import { validateConditions, visibleFieldKeys } from "../fields/conditions";
import { buildAnswersSchema } from "../fields/schema";

const fields = [
  { key: "role", label: "Role", type: "select", required: true, options: [{ value: "dev", label: "Developer" }, { value: "other", label: "Other" }], condition: null, position: 0, scope: "attendee", ticketTypeIds: null },
  { key: "role_other", label: "Which role?", type: "short_text", required: true, options: null, condition: { op: "and", rules: [{ fieldKey: "role", op: "eq", value: "other" }] }, position: 1, scope: "attendee", ticketTypeIds: null },
  { key: "diet", label: "Dietary needs", type: "multi_select", required: false, options: [{ value: "veg", label: "Vegetarian" }, { value: "gf", label: "Gluten-free" }], condition: null, position: 2, scope: "attendee", ticketTypeIds: ["vip"] },
  { key: "terms", label: "I agree", type: "consent", required: true, options: null, condition: null, position: 3, scope: "order", ticketTypeIds: null },
  { key: "guest_diet", label: "Guest dietary needs", type: "short_text", required: false, options: null, condition: null, position: 4, scope: "guest", ticketTypeIds: null },
] as any[];

describe("conditions", () => {
  it("shows dependent field only when the rule matches", () => {
    expect(visibleFieldKeys(fields, { role: "dev" }).has("role_other")).toBe(false);
    expect(visibleFieldKeys(fields, { role: "other" }).has("role_other")).toBe(true);
  });
  it("rejects forward references and self-references", () => {
    const bad = [
      { key: "a", position: 0, condition: { op: "and" as const, rules: [{ fieldKey: "b", op: "eq" as const, value: "1" }] } },
      { key: "b", position: 1, condition: { op: "and" as const, rules: [{ fieldKey: "b", op: "empty" as const }] } },
    ];
    const r = validateConditions(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(2);
  });
});

describe("answers schema", () => {
  const schema = buildAnswersSchema(fields, { scope: "attendee", ticketTypeId: "general" });

  it("does not require a hidden field", () => {
    expect(schema.safeParse({ role: "dev" }).success).toBe(true);
  });
  it("requires the dependent field once visible", () => {
    const r = schema.safeParse({ role: "other" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["role_other"]);
  });
  it("strips answers for hidden fields and fields for other ticket types", () => {
    const r = schema.safeParse({ role: "dev", role_other: "stale", diet: ["veg"] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ role: "dev" });
  });
  it("treats an empty checkbox group (false from the form) as no answer", () => {
    const vip = buildAnswersSchema(fields, { scope: "attendee", ticketTypeId: "vip" });
    const r = vip.safeParse({ role: "dev", diet: false });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ role: "dev" });
    const one = vip.safeParse({ role: "dev", diet: "veg" });
    if (one.success) expect(one.data.diet).toEqual(["veg"]);
    expect(one.success).toBe(true);
    const required = buildAnswersSchema([{ ...fields[2], required: true }], { scope: "attendee", ticketTypeId: "vip" });
    expect(required.safeParse({ diet: false }).success).toBe(false);
    expect(required.safeParse({ diet: ["gf"] }).success).toBe(true);
  });
  it("scopes guest questions separately from the host's", () => {
    const guest = buildAnswersSchema(fields, { scope: "guest", ticketTypeId: "general" });
    const r = guest.safeParse({ guest_diet: "vegan", role: "other" }); // host-only "role" is ignored for guests
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ guest_diet: "vegan" });
    expect(schema.safeParse({ role: "dev", guest_diet: "x" }).success && !("guest_diet" in (schema.parse({ role: "dev", guest_diet: "x" }) as object))).toBe(true);
  });
  it("validates order-scope consent separately", () => {
    const order = buildAnswersSchema(fields, { scope: "order" });
    expect(order.safeParse({}).success).toBe(false);
    expect(order.safeParse({ terms: true }).success).toBe(true);
  });
});
