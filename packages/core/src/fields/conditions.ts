import type { ConditionGroup, ConditionRule } from "@ot/db";

export type Answers = Record<string, unknown>;

function asStrings(v: unknown): string[] {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "boolean") return v ? ["true"] : [];
  return [String(v)];
}

export function evaluateRule(rule: ConditionRule, answers: Answers): boolean {
  const values = asStrings(answers[rule.fieldKey]);
  const target = rule.value ?? "";
  switch (rule.op) {
    case "empty": return values.length === 0;
    case "not_empty": return values.length > 0;
    case "eq": return values.length === 1 && values[0] === target;
    case "neq": return !(values.length === 1 && values[0] === target);
    case "contains": return values.some((v) => v === target || v.toLowerCase().includes(target.toLowerCase()));
  }
}

/** A field with no condition is always visible. */
export function evaluateCondition(group: ConditionGroup | null | undefined, answers: Answers): boolean {
  if (!group || group.rules.length === 0) return true;
  const results = group.rules.map((r) => evaluateRule(r, answers));
  return group.op === "and" ? results.every(Boolean) : results.some(Boolean);
}

export type FieldLike = { key: string; condition?: ConditionGroup | null; position: number };

/**
 * Builder-time validation: a field may only depend on fields that appear before it,
 * which also makes cycles impossible.
 */
export function validateConditions(fields: FieldLike[]): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const sorted = [...fields].sort((a, b) => a.position - b.position);
  const seen = new Set<string>();
  for (const f of sorted) {
    for (const r of f.condition?.rules ?? []) {
      if (r.fieldKey === f.key) errors.push(`Field "${f.key}" cannot depend on itself`);
      else if (!seen.has(r.fieldKey)) errors.push(`Field "${f.key}" depends on "${r.fieldKey}", which must come before it`);
    }
    seen.add(f.key);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

/** Resolve visibility for the whole form in one pass (fields must be validated). */
export function visibleFieldKeys(fields: FieldLike[], answers: Answers): Set<string> {
  const visible = new Set<string>();
  const sorted = [...fields].sort((a, b) => a.position - b.position);
  for (const f of sorted) {
    // answers to hidden fields are treated as empty for downstream conditions
    const effective: Answers = {};
    for (const k of visible) effective[k] = answers[k];
    if (evaluateCondition(f.condition, effective)) visible.add(f.key);
  }
  return visible;
}
