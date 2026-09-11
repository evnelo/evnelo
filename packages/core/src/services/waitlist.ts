import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, isNotNull, isNull, lt, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { attendees, events, orders, ticketTypes, waitlistEntries, type Database } from "@ot/db";
import { newId } from "../ids";
import type { DbOrTx } from "./db";

/**
 * Waitlist. Sold-out means every visible ticket type is exhausted or the event
 * capacity is reached. Promotion never oversells: it reserves the seat the same way checkout
 * does (conditional UPDATE on `ticket_types.held`, capacity counted with active offers) and the
 * offer lapses on a timer, returning the seat.
 */

export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export const WAITLIST_OFFER_HOURS = 24;

export const waitlistJoinInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
});

export function newWaitlistToken() {
  return randomBytes(24).toString("base64url");
}

export type WaitlistStatus = "waiting" | "offered" | "registered" | "expired";
export function waitlistStatus(e: Pick<WaitlistEntry, "registeredAt" | "holdExpiresAt" | "expiredAt" | "promotedAt">, now = new Date()): WaitlistStatus {
  if (e.registeredAt) return "registered";
  if (e.holdExpiresAt && e.holdExpiresAt.getTime() > now.getTime() && !e.expiredAt) return "offered";
  if (e.promotedAt) return "expired";
  return "waiting";
}

/** Attendees that occupy a seat: not cancelled/rejected, on an order that is still alive. */
export function liveAttendeeCount(tx: DbOrTx, eventId: string) {
  return tx.select({ n: sql<number>`count(*)` }).from(attendees).innerJoin(orders, eq(orders.id, attendees.orderId))
    .where(and(eq(attendees.eventId, eventId), isNull(attendees.deletedAt), notInArray(attendees.status, ["cancelled", "rejected"]), notInArray(orders.status, ["expired", "failed", "refunded"])))
    .then((r) => Number(r[0]?.n ?? 0));
}

/** Seats currently held for promoted waitlist entries (offers that have not lapsed or converted). */
export function activeWaitlistHolds(tx: DbOrTx, eventId: string, now = new Date(), excludeEntryId?: string) {
  const where = [eq(waitlistEntries.eventId, eventId), isNull(waitlistEntries.registeredAt), isNull(waitlistEntries.expiredAt), gt(waitlistEntries.holdExpiresAt, now)];
  if (excludeEntryId) where.push(sql`${waitlistEntries.id} <> ${excludeEntryId}`);
  return tx.select({ n: sql<number>`count(*)` }).from(waitlistEntries).where(and(...where)).then((r) => Number(r[0]?.n ?? 0));
}

/**
 * Is there room for `quantity` more people? Locks the event row so concurrent checkouts serialise
 * on the capacity check; ticket-type quantity is enforced separately by the conditional UPDATE.
 */
export async function capacityAllows(tx: DbOrTx, eventId: string, quantity: number, opts: { now?: Date; excludeWaitlistEntryId?: string } = {}) {
  const [event] = await tx.select({ capacity: events.capacity }).from(events).where(eq(events.id, eventId)).for("update");
  if (!event || event.capacity == null) return true;
  const [live, holds] = await Promise.all([liveAttendeeCount(tx, eventId), activeWaitlistHolds(tx, eventId, opts.now, opts.excludeWaitlistEntryId)]);
  return live + holds + quantity <= event.capacity;
}

export async function joinWaitlist(db: Database, eventId: string, input: z.infer<typeof waitlistJoinInput>) {
  return db.transaction(async (tx) => {
    const [live] = await tx.select({ id: attendees.id }).from(attendees).innerJoin(orders, eq(orders.id, attendees.orderId))
      .where(and(eq(attendees.eventId, eventId), eq(attendees.email, input.email), isNull(attendees.deletedAt), notInArray(attendees.status, ["cancelled", "rejected"]), notInArray(orders.status, ["expired", "failed", "refunded"])))
      .limit(1);
    if (live) return { outcome: "registered" as const };
    const [existing] = await tx.select().from(waitlistEntries).where(and(eq(waitlistEntries.eventId, eventId), eq(waitlistEntries.email, input.email))).limit(1);
    if (existing) return { outcome: "already" as const, entry: existing };
    const id = newId();
    await tx.insert(waitlistEntries).values({ id, eventId, email: input.email, name: input.name });
    const [entry] = await tx.select().from(waitlistEntries).where(eq(waitlistEntries.id, id)).limit(1);
    const [pos] = await tx.select({ n: sql<number>`count(*)` }).from(waitlistEntries).where(and(eq(waitlistEntries.eventId, eventId), isNull(waitlistEntries.registeredAt), sql`${waitlistEntries.createdAt} <= ${entry!.createdAt}`));
    return { outcome: "joined" as const, entry: entry!, position: Number(pos?.n ?? 1) };
  });
}

export async function listWaitlist(db: Database, eventId: string) {
  return db.select({ entry: waitlistEntries, ticketTypeName: ticketTypes.name })
    .from(waitlistEntries).leftJoin(ticketTypes, eq(ticketTypes.id, waitlistEntries.ticketTypeId))
    .where(eq(waitlistEntries.eventId, eventId)).orderBy(asc(waitlistEntries.createdAt));
}

/** People still waiting or holding an offer (for tab counts). */
export async function countOpenWaitlist(db: Database, eventId: string) {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(waitlistEntries).where(and(eq(waitlistEntries.eventId, eventId), isNull(waitlistEntries.registeredAt)));
  return Number(row?.n ?? 0);
}

export async function removeWaitlistEntry(db: Database, eventId: string, id: string) {
  return db.transaction(async (tx) => {
    const [entry] = await tx.select().from(waitlistEntries).where(and(eq(waitlistEntries.id, id), eq(waitlistEntries.eventId, eventId))).for("update");
    if (!entry) return false;
    if (waitlistStatus(entry) === "offered" && entry.ticketTypeId) await tx.update(ticketTypes).set({ held: sql`greatest(${ticketTypes.held} - 1, 0)` }).where(eq(ticketTypes.id, entry.ticketTypeId));
    await tx.delete(waitlistEntries).where(eq(waitlistEntries.id, id));
    return true;
  });
}

export type PromoteResult = { ok: true; entry: WaitlistEntry } | { ok: false; reason: "not_found" | "already_offered" | "registered" | "no_room" };

/** Hold one seat on `ticketTypeId` for the entry and mint the offer link. */
export async function promoteWaitlistEntry(db: Database, eventId: string, entryId: string, ticketTypeId: string, opts: { hours?: number; now?: Date } = {}): Promise<PromoteResult> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [entry] = await tx.select().from(waitlistEntries).where(and(eq(waitlistEntries.id, entryId), eq(waitlistEntries.eventId, eventId))).for("update");
    if (!entry) return { ok: false, reason: "not_found" };
    const status = waitlistStatus(entry, now);
    if (status === "registered") return { ok: false, reason: "registered" };
    if (status === "offered") return { ok: false, reason: "already_offered" };
    if (!(await capacityAllows(tx, eventId, 1, { now }))) return { ok: false, reason: "no_room" };
    const [tt] = await tx.select({ id: ticketTypes.id, quantity: ticketTypes.quantity }).from(ticketTypes).where(and(eq(ticketTypes.id, ticketTypeId), eq(ticketTypes.eventId, eventId))).limit(1);
    if (!tt) return { ok: false, reason: "no_room" };
    const reserve = await tx.update(ticketTypes).set({ held: sql`${ticketTypes.held} + 1` })
      .where(and(eq(ticketTypes.id, ticketTypeId), tt.quantity == null ? sql`1=1` : sql`${ticketTypes.sold} + ${ticketTypes.held} + 1 <= ${ticketTypes.quantity}`));
    if (Number((reserve[0] as { affectedRows?: number }).affectedRows ?? 0) === 0) return { ok: false, reason: "no_room" };
    await tx.update(waitlistEntries).set({
      ticketTypeId, token: newWaitlistToken(), promotedAt: now, holdExpiresAt: new Date(now.getTime() + (opts.hours ?? WAITLIST_OFFER_HOURS) * 3_600_000), expiredAt: null,
    }).where(eq(waitlistEntries.id, entryId));
    const [updated] = await tx.select().from(waitlistEntries).where(eq(waitlistEntries.id, entryId)).limit(1);
    return { ok: true, entry: updated! };
  });
}

export async function getWaitlistOffer(db: DbOrTx, token: string) {
  if (!/^[A-Za-z0-9_-]{16,48}$/.test(token)) return null;
  const [row] = await db.select().from(waitlistEntries).where(eq(waitlistEntries.token, token)).limit(1);
  return row ?? null;
}

/** An offer the visitor can still use: promoted, not lapsed, not yet converted. */
export function offerIsOpen(entry: WaitlistEntry | null, now = new Date()): entry is WaitlistEntry & { ticketTypeId: string; holdExpiresAt: Date } {
  return !!entry && !!entry.ticketTypeId && waitlistStatus(entry, now) === "offered";
}

/**
 * Convert an open offer inside the checkout transaction: give the held seat back so the regular
 * reservation that follows can take it, and mark the entry registered. False when the offer is no
 * longer open (lapsed meanwhile).
 */
export async function consumeWaitlistOffer(tx: DbOrTx, entryId: string, orderId: string, now = new Date()) {
  const [entry] = await tx.select().from(waitlistEntries).where(eq(waitlistEntries.id, entryId)).for("update");
  if (!offerIsOpen(entry ?? null, now)) return false;
  await tx.update(ticketTypes).set({ held: sql`greatest(${ticketTypes.held} - 1, 0)` }).where(eq(ticketTypes.id, entry!.ticketTypeId!));
  await tx.update(waitlistEntries).set({ registeredAt: now, orderId, holdExpiresAt: null }).where(eq(waitlistEntries.id, entryId));
  return true;
}

/** Job: lapsed offers give their seat back and can be promoted again. */
export async function expireWaitlistOffers(db: Database, now = new Date(), limit = 100) {
  const stale = await db.select({ id: waitlistEntries.id, ticketTypeId: waitlistEntries.ticketTypeId }).from(waitlistEntries)
    .where(and(isNull(waitlistEntries.registeredAt), isNull(waitlistEntries.expiredAt), isNotNull(waitlistEntries.holdExpiresAt), lt(waitlistEntries.holdExpiresAt, now)))
    .limit(limit);
  let released = 0;
  for (const s of stale) {
    await db.transaction(async (tx) => {
      const flip = await tx.update(waitlistEntries).set({ expiredAt: now }).where(and(eq(waitlistEntries.id, s.id), isNull(waitlistEntries.expiredAt), isNull(waitlistEntries.registeredAt)));
      if (Number((flip[0] as { affectedRows?: number }).affectedRows ?? 0) === 0) return;
      if (s.ticketTypeId) await tx.update(ticketTypes).set({ held: sql`greatest(${ticketTypes.held} - 1, 0)` }).where(eq(ticketTypes.id, s.ticketTypeId));
      released++;
    });
  }
  return released;
}

/** Ticket types with room for one more seat, for the promote control. */
export async function promotableTicketTypes(db: Database, eventId: string) {
  const rows = await db.select().from(ticketTypes).where(eq(ticketTypes.eventId, eventId)).orderBy(asc(ticketTypes.position));
  return rows.map((t) => ({ id: t.id, name: t.name, priceMinor: t.priceMinor, currency: t.currency, room: t.quantity == null ? null : Math.max(t.quantity - t.sold - t.held, 0) }));
}

