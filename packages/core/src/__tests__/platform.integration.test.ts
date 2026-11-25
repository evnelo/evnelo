import { expect, it } from "vitest";
import { describeIntegration } from "./helpers/integration";
import { and, eq, isNull } from "drizzle-orm";
import { attendees, createDb, events } from "@evnelo/db";
import { platformOrganization, platformOverview, type MoneyByCurrency } from "../services";

/** Read-only against the seeded local MySQL when reachable; skipped otherwise. */
const url = process.env.DATABASE_URL ?? "mysql://evnelo:evnelo@localhost:3306/evnelo";
const db = createDb(url);
const seed = await db.select({ attendeeId: attendees.id, eventId: events.id, organizationId: events.organizationId })
  .from(attendees).innerJoin(events, eq(events.id, attendees.eventId))
  .where(and(eq(attendees.status, "confirmed"), isNull(attendees.deletedAt), isNull(events.deletedAt))).limit(1)
  .then((r) => r[0] ?? null, () => null);

const sum = (rows: MoneyByCurrency[]) => {
  const out: Record<string, number> = {};
  for (const m of rows) for (const [c, v] of Object.entries(m)) out[c] = (out[c] ?? 0) + v.net;
  return out;
};

describeIntegration(Boolean(seed), "no confirmed attendee in the database")("platform admin queries against MySQL", () => {
  it("lists every organization with counts that add up to the platform totals", async () => {
    const s = seed!;
    const overview = await platformOverview(db);
    expect(overview.counts.organizations).toBeGreaterThan(0);
    expect(overview.counts.registrations).toBeGreaterThan(0);
    const row = overview.organizations.find((o) => o.id === s.organizationId);
    expect(row?.registrations).toBeGreaterThan(0);
    expect(row?.events).toBeGreaterThan(0);

    const live = overview.organizations.filter((o) => !o.deletedAt);
    expect(live.length).toBe(overview.counts.organizations);
    // every paid order belongs to some organization, so the per-organization nets add up to the platform's
    const platformNet = Object.fromEntries(Object.entries(overview.money).map(([c, m]) => [c, m.net]));
    expect(sum(overview.organizations.map((o) => o.money))).toEqual(platformNet);
    for (const m of Object.values(overview.money)) expect(m.net).toBe(m.gross - m.refunded);
  });

  it("loads one organization with its events, members and sales", async () => {
    const s = seed!;
    const detail = await platformOrganization(db, s.organizationId);
    expect(detail?.organization.id).toBe(s.organizationId);
    const event = detail?.events.find((e) => e.id === s.eventId);
    expect(event?.registrations).toBeGreaterThan(0);
    const fromOverview = (await platformOverview(db)).organizations.find((o) => o.id === s.organizationId);
    // the seeded demo organization has no members, so compare instead of assuming some
    expect(detail?.members.length).toBe(fromOverview?.members);
    expect(detail?.events.length).toBe(fromOverview?.events);
    expect(sum([detail!.money])).toEqual(sum([fromOverview!.money]));
    expect(await platformOrganization(db, "01AAAAAAAAAAAAAAAAAAAAAAAA")).toBeNull();
  });
});
