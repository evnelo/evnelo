import { describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { attendees, createDb } from "@ot/db";
import { getAttendeeView, getOrderDetails, getOrganization, getTicketType, listAttendeesPage, listCheckInsPage, listOrdersPage } from "../services";

/** Read-only against the seeded local MySQL when reachable; skipped otherwise. */
const url = process.env.DATABASE_URL ?? "mysql://openticket:openticket@localhost:3306/openticket";
const db = createDb(url);
const seed = await db.select().from(attendees).where(and(eq(attendees.status, "confirmed"), isNull(attendees.deletedAt))).limit(1).then((r) => r[0] ?? null, () => null);

describe.skipIf(!seed)("REST listings against MySQL", () => {
  it("pages attendees newest first with ticket and check-in state", async () => {
    const s = seed!;
    const first = await listAttendeesPage(db, s.eventId, { limit: 2, offset: 0 });
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(2);
    for (const row of first) {
      expect(row.attendee.eventId).toBe(s.eventId);
      expect(row.checkedInAt === null || row.checkedInAt instanceof Date).toBe(true);
      if (row.ticketToken) expect(row.ticketId).toHaveLength(26);
    }
    const all = await listAttendeesPage(db, s.eventId, { limit: 201 });
    const second = await listAttendeesPage(db, s.eventId, { limit: 2, offset: 2 });
    expect([...first, ...second].map((r) => r.attendee.id)).toEqual(all.slice(0, first.length + second.length).map((r) => r.attendee.id));

    expect((await listAttendeesPage(db, s.eventId, { status: "confirmed" })).every((r) => r.attendee.status === "confirmed")).toBe(true);
    expect((await listAttendeesPage(db, s.eventId, { q: s.email })).some((r) => r.attendee.id === s.id)).toBe(true);
    expect((await getAttendeeView(db, s.eventId, s.id))?.attendee.email).toBe(s.email);
    expect(await getAttendeeView(db, "01AAAAAAAAAAAAAAAAAAAAAAAA", s.id)).toBeNull();
  });

  it("lists orders with filters and loads one with items and party", async () => {
    const s = seed!;
    const orders = await listOrdersPage(db, s.eventId, { limit: 5 });
    expect(orders.some((o) => o.order.id === s.orderId)).toBe(true);
    const mine = orders.find((o) => o.order.id === s.orderId)!;
    expect(mine.attendeeCount).toBeGreaterThan(0);
    expect((await listOrdersPage(db, s.eventId, { email: mine.order.email.toUpperCase() })).every((o) => o.order.email === mine.order.email)).toBe(true);
    expect((await listOrdersPage(db, s.eventId, { status: mine.order.status })).every((o) => o.order.status === mine.order.status)).toBe(true);

    const details = await getOrderDetails(db, s.eventId, s.orderId);
    expect(details?.order.id).toBe(s.orderId);
    expect(details?.items.length).toBeGreaterThan(0);
    expect(details?.items[0]?.ticketTypeName).toBeTruthy();
    expect(details?.attendees.some((a) => a.attendee.id === s.id)).toBe(true);
    expect(await getOrderDetails(db, "01AAAAAAAAAAAAAAAAAAAAAAAA", s.orderId)).toBeNull();
  });

  it("lists check-ins, ticket types and the organization", async () => {
    const s = seed!;
    const checkIns = await listCheckInsPage(db, s.eventId, { limit: 3 });
    expect(checkIns.length).toBeLessThanOrEqual(3);
    for (const c of checkIns) expect(c.checkedInAt).toBeInstanceOf(Date);
    expect((await getTicketType(db, s.eventId, s.ticketTypeId))?.id).toBe(s.ticketTypeId);
    expect(await getTicketType(db, "01AAAAAAAAAAAAAAAAAAAAAAAA", s.ticketTypeId)).toBeNull();
    const order = await getOrderDetails(db, s.eventId, s.orderId);
    expect((await getOrganization(db, order!.order.organizationId))?.id).toBe(order!.order.organizationId);
  });
});
