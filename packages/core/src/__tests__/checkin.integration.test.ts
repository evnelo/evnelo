import { afterAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { attendees, checkIns, createDb, tickets } from "@ot/db";
import { newId } from "../ids";
import { checkInStats, checkInTicket, newTicketToken, undoCheckIn } from "../services";

/**
 * Against the local MySQL when reachable (and seeded); skipped otherwise. Proves the property
 * mocks cannot: N staff scanning the same ticket at once produce exactly one check-in.
 */
const url = process.env.DATABASE_URL ?? "mysql://openticket:openticket@localhost:3306/openticket";
const db = createDb(url);
const seed = await db.select().from(attendees).where(and(eq(attendees.status, "confirmed"), isNull(attendees.deletedAt))).limit(1).then((r) => r[0] ?? null, () => null);

const attendeeId = newId();
const ticketId = newId();
const token = newTicketToken();

describe.skipIf(!seed)("checkInTicket against MySQL", () => {
  afterAll(async () => {
    await db.delete(checkIns).where(eq(checkIns.ticketId, ticketId));
    await db.delete(tickets).where(eq(tickets.id, ticketId));
    await db.delete(attendees).where(eq(attendees.id, attendeeId));
  });

  it("checks a ticket in exactly once under concurrency, undoes, and checks in again", async () => {
    const s = seed!;
    await db.insert(attendees).values({ id: attendeeId, eventId: s.eventId, orderId: s.orderId, ticketTypeId: s.ticketTypeId, name: "Race Test", email: `race-${attendeeId}@example.com`, status: "confirmed" });
    await db.insert(tickets).values({ id: ticketId, attendeeId, eventId: s.eventId, token });
    const before = await checkInStats(db, s.eventId);

    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => checkInTicket(db, s.eventId, i % 2 ? { token: `https://x.test/t/${token}` } : { ticketId }, { userId: null, method: "scan" })));
    expect(results.filter((r) => r.outcome === "ok")).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "already")).toHaveLength(11);
    expect(results.every((r) => r.attendee?.name === "Race Test")).toBe(true);
    expect((await checkInStats(db, s.eventId)).checkedIn).toBe(before.checkedIn + 1);

    expect(await undoCheckIn(db, s.eventId, ticketId)).toBe(true);
    expect(await undoCheckIn(db, s.eventId, ticketId)).toBe(false);
    expect((await checkInStats(db, s.eventId)).checkedIn).toBe(before.checkedIn);
    expect((await checkInTicket(db, s.eventId, { token }, { userId: null, method: "manual" })).outcome).toBe("ok");

    expect((await checkInTicket(db, "01AAAAAAAAAAAAAAAAAAAAAAAA", { token }, { userId: null, method: "scan" })).outcome).toBe("wrong_event");
    expect((await checkInTicket(db, s.eventId, { token: "nope" }, { userId: null, method: "scan" })).outcome).toBe("not_found");
  });
});
