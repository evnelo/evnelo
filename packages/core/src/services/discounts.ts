import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { discountCodes, type Database } from "@evnelo/db";
import { newId } from "../ids";
import type { Discount } from "../fees";
import type { DbOrTx } from "./db";

/**
 * Discount codes: percent or fixed amount off the order subtotal, with optional use
 * limit and expiry. Validation is pure (`discountProblem`) so the checkout preview and the order
 * route agree; the use is spent with a conditional update inside the order transaction.
 */

export type DiscountCode = typeof discountCodes.$inferSelect;

export const discountCodeInput = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, "Letters, numbers, hyphens; 3 to 40 characters"),
  kind: z.enum(["percent", "fixed"]),
  value: z.coerce.number().int().min(1),
  maxUses: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
}).refine((d) => d.kind !== "percent" || d.value <= 100, { message: "Percent discounts go up to 100.", path: ["value"] });
export type DiscountCodeInput = z.infer<typeof discountCodeInput>;

export const normalizeCode = (code: string) => code.trim().toUpperCase();

export type DiscountProblem = "not_found" | "expired" | "exhausted";

export function discountProblem(code: Pick<DiscountCode, "uses" | "maxUses" | "expiresAt"> | null | undefined, now = new Date()): DiscountProblem | null {
  if (!code) return "not_found";
  if (code.expiresAt && code.expiresAt.getTime() <= now.getTime()) return "expired";
  if (code.maxUses != null && code.uses >= code.maxUses) return "exhausted";
  return null;
}

export const discountProblemMessage: Record<DiscountProblem, string> = {
  not_found: "That code isn't valid for this event.",
  expired: "That code has expired.",
  exhausted: "That code has been used up.",
};

export function toDiscount(code: Pick<DiscountCode, "kind" | "value">): Discount {
  return code.kind === "percent" ? { kind: "percent", value: code.value } : { kind: "fixed", value: code.value };
}

export async function findDiscountCode(db: DbOrTx, eventId: string, code: string) {
  const [row] = await db.select().from(discountCodes).where(and(eq(discountCodes.eventId, eventId), eq(discountCodes.code, normalizeCode(code)))).limit(1);
  return row ?? null;
}

export async function listDiscountCodes(db: Database, eventId: string) {
  return db.select().from(discountCodes).where(eq(discountCodes.eventId, eventId)).orderBy(desc(discountCodes.createdAt));
}

export async function createDiscountCode(db: Database, eventId: string, input: DiscountCodeInput) {
  const id = newId();
  try {
    await db.insert(discountCodes).values({ id, eventId, code: input.code, kind: input.kind, value: input.value, maxUses: input.maxUses ?? null, expiresAt: input.expiresAt ?? null });
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new Error(`Code ${input.code} already exists for this event.`);
    throw e;
  }
  const [row] = await db.select().from(discountCodes).where(eq(discountCodes.id, id)).limit(1);
  return row!;
}

export async function deleteDiscountCode(db: Database, eventId: string, id: string) {
  const result = await db.delete(discountCodes).where(and(eq(discountCodes.id, id), eq(discountCodes.eventId, eventId)));
  return Number((result[0] as { affectedRows?: number }).affectedRows ?? 0) > 0;
}

/** Spend one use, atomically; false when the code is exhausted or expired meanwhile. */
export async function consumeDiscountCode(tx: DbOrTx, id: string, now = new Date()) {
  const result = await tx.update(discountCodes)
    .set({ uses: sql`${discountCodes.uses} + 1` })
    .where(and(
      eq(discountCodes.id, id),
      or(isNull(discountCodes.maxUses), lt(discountCodes.uses, discountCodes.maxUses)),
      or(isNull(discountCodes.expiresAt), gt(discountCodes.expiresAt, now)),
    ));
  return Number((result[0] as { affectedRows?: number }).affectedRows ?? 0) === 1;
}

/** Give a use back when the order that consumed it dies before payment. */
export async function releaseDiscountCode(tx: DbOrTx, id: string) {
  await tx.update(discountCodes).set({ uses: sql`greatest(${discountCodes.uses} - 1, 0)` }).where(eq(discountCodes.id, id));
}
