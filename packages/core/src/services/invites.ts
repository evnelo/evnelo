import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { eventInvites, type Database } from "@ot/db";
import { newId } from "../ids";
import type { DbOrTx } from "./db";

/**
 * Private-event invitations. An invite is a link token, optionally bound
 * to one email, with a use budget and an expiry. Opening `/i/{token}` stores the token in a
 * cookie scoped to the event; the event page and the order route honour it. Members of the
 * organization never need one.
 */

export type EventInvite = typeof eventInvites.$inferSelect;

export const eventInviteInput = z.object({
  email: z.string().trim().toLowerCase().email().max(255).optional().or(z.literal("")),
  maxUses: z.coerce.number().int().min(1).max(10_000).default(1),
  expiresInDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
});
export type EventInviteInput = z.infer<typeof eventInviteInput>;

export function newInviteToken() {
  return randomBytes(24).toString("base64url"); // 32 chars, fits char(48)
}

export type InviteStatus = "valid" | "expired" | "exhausted";

export function inviteStatus(invite: Pick<EventInvite, "uses" | "maxUses" | "expiresAt">, now = new Date()): InviteStatus {
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) return "expired";
  if (invite.uses >= invite.maxUses) return "exhausted";
  return "valid";
}

export async function createEventInvite(db: Database, eventId: string, input: EventInviteInput, now = new Date()) {
  const id = newId();
  const token = newInviteToken();
  await db.insert(eventInvites).values({
    id, eventId, token, email: input.email || null, maxUses: input.maxUses,
    expiresAt: input.expiresInDays ? new Date(now.getTime() + input.expiresInDays * 86_400_000) : null,
  });
  const [row] = await db.select().from(eventInvites).where(eq(eventInvites.id, id)).limit(1);
  return row!;
}

export async function listEventInvites(db: Database, eventId: string) {
  return db.select().from(eventInvites).where(eq(eventInvites.eventId, eventId)).orderBy(desc(eventInvites.createdAt));
}

export async function deleteEventInvite(db: Database, eventId: string, id: string) {
  const result = await db.delete(eventInvites).where(and(eq(eventInvites.id, id), eq(eventInvites.eventId, eventId)));
  return Number((result[0] as { affectedRows?: number }).affectedRows ?? 0) > 0;
}

export async function getEventInvite(db: DbOrTx, token: string) {
  if (!/^[A-Za-z0-9_-]{16,48}$/.test(token)) return null;
  const [row] = await db.select().from(eventInvites).where(eq(eventInvites.token, token)).limit(1);
  return row ?? null;
}

/** Spend one use, atomically; false when the invite is exhausted or expired (race-safe). */
export async function consumeEventInvite(tx: DbOrTx, inviteId: string, now = new Date()) {
  const result = await tx.update(eventInvites)
    .set({ uses: sql`${eventInvites.uses} + 1` })
    .where(and(
      eq(eventInvites.id, inviteId),
      lt(eventInvites.uses, eventInvites.maxUses),
      or(isNull(eventInvites.expiresAt), gt(eventInvites.expiresAt, now)),
    ));
  return Number((result[0] as { affectedRows?: number }).affectedRows ?? 0) === 1;
}
