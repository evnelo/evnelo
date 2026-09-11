import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { attendees, checkIns, events, tickets, ticketTypes, type Database } from "@evnelo/db";
import { emitWebhookEvent } from "./webhooks";
import { newId } from "../ids";

/**
 * Door check-in. A ticket is checked in when it has a `check_ins` row with
 * `undone_at IS NULL`; undo sets `undone_at` and keeps the row for the audit trail. Check-in is
 * idempotent under concurrency: the insert is conditional on no active row existing, so two
 * staff scanning the same ticket in the same instant produce one check-in and one "already".
 */

export type CheckInMethod = "scan" | "manual";
export type CheckInOutcome = "ok" | "already" | "not_found" | "revoked" | "not_confirmed" | "wrong_event";

export type CheckInAttendee = {
  ticketId: string;
  attendeeId: string;
  name: string;
  email: string;
  ticketTypeName: string;
  hostName: string | null;
  checkedInAt: Date | null;
};

const activeCheckIn = (ticketId: typeof tickets.id) =>
  sql<string | Date | null>`(select max(c.created_at) from ${checkIns} c where c.ticket_id = ${ticketId} and c.undone_at is null)`;

/**
 * The mysql2 driver hands drizzle DATETIME values as strings so column modes can map them; a raw
 * subquery skips that mapping, so convert here the same way drizzle does (values are stored in UTC).
 */
export function fromDbDatetime(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  return new Date(`${value.replace(" ", "T")}Z`);
}

/** Accepts a raw token, a ticket URL, or the URL with extra path (wallet passes encode the same URL). */
export function parseTicketToken(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const match = /\/t\/([A-Za-z0-9_-]{16,64})(?:[/?#]|$)/.exec(text);
  if (match) return match[1]!;
  return /^[A-Za-z0-9_-]{16,64}$/.test(text) ? text : null;
}

async function loadTicket(db: Database, where: ReturnType<typeof eq>) {
  const [row] = await db
    .select({
      ticketId: tickets.id, eventId: tickets.eventId, revokedAt: tickets.revokedAt,
      attendeeId: attendees.id, name: attendees.name, email: attendees.email, status: attendees.status, guestOf: attendees.guestOfAttendeeId,
      ticketTypeName: ticketTypes.name, checkedInAt: activeCheckIn(tickets.id),
    })
    .from(tickets)
    .innerJoin(attendees, eq(attendees.id, tickets.attendeeId))
    .innerJoin(ticketTypes, eq(ticketTypes.id, attendees.ticketTypeId))
    .where(where)
    .limit(1);
  if (!row) return null;
  const [host] = row.guestOf ? await db.select({ name: attendees.name }).from(attendees).where(eq(attendees.id, row.guestOf)).limit(1) : [];
  return { ...row, hostName: host?.name ?? null };
}

function toAttendee(row: NonNullable<Awaited<ReturnType<typeof loadTicket>>>): CheckInAttendee {
  return { ticketId: row.ticketId, attendeeId: row.attendeeId, name: row.name, email: row.email, ticketTypeName: row.ticketTypeName, hostName: row.hostName, checkedInAt: fromDbDatetime(row.checkedInAt) };
}

export type CheckInResult = { outcome: CheckInOutcome; attendee: CheckInAttendee | null; checkedInAt: Date | null };

/**
 * Check a ticket in by token (scanner) or id (manual list / offline replay). Never throws for
 * a bad ticket: the outcome says what the door staff should do.
 */
export async function checkInTicket(db: Database, eventId: string, ref: { token?: string; ticketId?: string }, by: { userId: string | null; method: CheckInMethod }): Promise<CheckInResult> {
  const token = ref.token ? parseTicketToken(ref.token) : null;
  if (!token && !ref.ticketId) return { outcome: "not_found", attendee: null, checkedInAt: null };
  const row = await loadTicket(db, token ? eq(tickets.token, token) : eq(tickets.id, ref.ticketId!));
  if (!row) return { outcome: "not_found", attendee: null, checkedInAt: null };
  const attendee = toAttendee(row);
  if (row.eventId !== eventId) return { outcome: "wrong_event", attendee, checkedInAt: null };
  if (row.revokedAt) return { outcome: "revoked", attendee, checkedInAt: null };
  if (row.status !== "confirmed") return { outcome: "not_confirmed", attendee, checkedInAt: null };

  const now = new Date();
  const id = newId();
  // conditional insert: only when no active check-in exists for this ticket (race-safe without a lock)
  const result = await db.execute(sql`
    insert into ${checkIns} (id, ticket_id, event_id, checked_in_by, method, created_at)
    select ${id}, ${row.ticketId}, ${eventId}, ${by.userId}, ${by.method}, ${now}
    from dual
    where not exists (select 1 from ${checkIns} c where c.ticket_id = ${row.ticketId} and c.undone_at is null)
  `);
  const inserted = Number((result[0] as { affectedRows?: number }).affectedRows ?? 0) === 1;
  if (inserted) {
    const [ev] = await db.select({ organizationId: events.organizationId }).from(events).where(eq(events.id, eventId)).limit(1);
    if (ev) await emitWebhookEvent(db, ev.organizationId, "attendee.checked_in", { eventId, ticketId: row.ticketId, attendeeId: row.attendeeId, name: row.name, email: row.email, ticketTypeName: row.ticketTypeName, method: by.method, checkedInAt: now.toISOString(), checkedInBy: by.userId });
  }
  if (inserted) return { outcome: "ok", attendee: { ...attendee, checkedInAt: now }, checkedInAt: now };
  const [existing] = await db.select({ at: checkIns.createdAt }).from(checkIns).where(and(eq(checkIns.ticketId, row.ticketId), isNull(checkIns.undoneAt))).orderBy(desc(checkIns.createdAt)).limit(1);
  const at = existing?.at ?? attendee.checkedInAt;
  return { outcome: "already", attendee: { ...attendee, checkedInAt: at }, checkedInAt: at };
}

/** Undo the active check-in for a ticket. Returns false when there was none. */
export async function undoCheckIn(db: Database, eventId: string, ticketId: string) {
  const result = await db.update(checkIns).set({ undoneAt: new Date() })
    .where(and(eq(checkIns.ticketId, ticketId), eq(checkIns.eventId, eventId), isNull(checkIns.undoneAt)));
  return Number((result[0] as { affectedRows?: number }).affectedRows ?? 0) > 0;
}

export async function checkInStats(db: Database, eventId: string) {
  const [row] = await db.select({
    checkedIn: sql<number>`(select count(*) from ${checkIns} c where c.event_id = ${eventId} and c.undone_at is null)`,
    confirmed: sql<number>`(select count(*) from ${tickets} t inner join ${attendees} a on a.id = t.attendee_id where t.event_id = ${eventId} and t.revoked_at is null and a.status = 'confirmed' and a.deleted_at is null)`,
  }).from(sql`dual`);
  return { checkedIn: Number(row?.checkedIn ?? 0), confirmed: Number(row?.confirmed ?? 0) };
}

/** Confirmed ticket holders for manual check-in and the offline manifest. `q` matches name, email or phone. */
export async function listCheckInAttendees(db: Database, eventId: string, opts: { q?: string; limit?: number } = {}) {
  const host = db.$with("host").as(db.select({ id: attendees.id, name: attendees.name }).from(attendees));
  const where = [eq(tickets.eventId, eventId), isNull(tickets.revokedAt), eq(attendees.status, "confirmed"), isNull(attendees.deletedAt)];
  if (opts.q?.trim()) {
    const q = `%${opts.q.trim()}%`;
    where.push(or(like(attendees.name, q), like(attendees.email, q), like(attendees.phone, q))!);
  }
  const rows = await db.with(host)
    .select({
      ticketId: tickets.id, token: tickets.token, attendeeId: attendees.id, name: attendees.name, email: attendees.email,
      ticketTypeName: ticketTypes.name, hostName: host.name, checkedInAt: activeCheckIn(tickets.id),
    })
    .from(tickets)
    .innerJoin(attendees, eq(attendees.id, tickets.attendeeId))
    .innerJoin(ticketTypes, eq(ticketTypes.id, attendees.ticketTypeId))
    .leftJoin(host, eq(host.id, attendees.guestOfAttendeeId))
    .where(and(...where))
    .orderBy(attendees.name)
    .limit(opts.limit ?? 5000);
  return rows.map((r) => ({ ...r, checkedInAt: fromDbDatetime(r.checkedInAt) }));
}

/** Most recent check-ins for the "recent" list on the scanner. */
export async function recentCheckIns(db: Database, eventId: string, limit = 20) {
  const rows = await db
    .select({ ticketId: checkIns.ticketId, at: checkIns.createdAt, method: checkIns.method, name: attendees.name, ticketTypeName: ticketTypes.name })
    .from(checkIns)
    .innerJoin(tickets, eq(tickets.id, checkIns.ticketId))
    .innerJoin(attendees, eq(attendees.id, tickets.attendeeId))
    .innerJoin(ticketTypes, eq(ticketTypes.id, attendees.ticketTypeId))
    .where(and(eq(checkIns.eventId, eventId), isNull(checkIns.undoneAt)))
    .orderBy(desc(checkIns.createdAt))
    .limit(limit);
  return rows;
}
