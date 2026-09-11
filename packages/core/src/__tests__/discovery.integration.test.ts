/**
 * Exercises the discovery SQL against a real MySQL 8 (`docker compose up db -d`): the Haversine
 * radius, the price summary subqueries and the visibility rules are all things a fake database
 * cannot prove. Skips itself when the database is unreachable, so `pnpm test` still runs anywhere.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { createDb, events, eventTags, organizations, tags, ticketTypes } from "@evnelo/db";
import { ulid } from "ulid";
import { listIndexableEvents, listIndexableOrganizations, listPublicEvents, listPublicTags } from "../services/events";

const url = process.env.DATABASE_URL ?? "mysql://evnelo:evnelo@localhost:3306/evnelo";
const database = createDb(url);
const reachable = await database.execute("select 1").then(() => true, () => false);

const days = (n: number, hour = 18) => new Date(new Date(Date.now() + n * 86_400_000).setUTCHours(hour, 0, 0, 0));

// Every fixture shares one made-up city, so each assertion can scope itself to this run and
// ignore whatever else is seeded in the developer's database.
const run = ulid().slice(-8).toLowerCase();
const city = `Itestville-${run}`;
const tagSlug = `itest-${run}`;
const orgId = ulid();
const orgSlug = `itest-org-${run}`;
const ids: Record<string, string> = {
  free: ulid(), paid: ulid(), online: ulid(), hybrid: ulid(), mixed: ulid(),
  unlisted: ulid(), private: ulid(), draft: ulid(), deleted: ulid(), badCoords: ulid(),
};
const tagId = ulid();

const names = (rows: readonly { id: string }[]) =>
  Object.entries(ids).filter(([, id]) => rows.some((row) => row.id === id)).map(([name]) => name).sort();

describe.skipIf(!reachable)("public discovery queries", () => {

  beforeAll(async () => {
    await database.insert(organizations).values({ id: orgId, slug: orgSlug, name: `Integration Test Org ${run}` });
    await database.insert(tags).values({ id: tagId, slug: tagSlug, name: `Itest ${run}` });
    const base = { organizationId: orgId, timezone: "America/Sao_Paulo", city, country: "BR", visibility: "public" as const, status: "published" as const, publishedAt: new Date() };
    await database.insert(events).values([
      // São Paulo, free, in person, day 2
      { ...base, id: ids.free!, slug: `itest-free-${run}`, name: "Itest free meetup", startsAt: days(2), endsAt: days(2, 21), locationType: "in_person", lat: "-23.5578", lng: "-46.6606" },
      // São Paulo, paid, in person, day 5
      { ...base, id: ids.paid!, slug: `itest-paid-${run}`, name: "Itest paid workshop", startsAt: days(5), endsAt: days(5, 21), locationType: "in_person", lat: "-23.5600", lng: "-46.6700" },
      // online only, day 8
      { ...base, id: ids.online!, slug: `itest-online-${run}`, name: "Itest online session", startsAt: days(8), endsAt: days(8, 20), locationType: "online" },
      // Lisbon, hybrid, day 10
      { ...base, id: ids.hybrid!, slug: `itest-hybrid-${run}`, name: "Itest hybrid summit", startsAt: days(10), endsAt: days(10, 20), locationType: "hybrid", lat: "38.7223", lng: "-9.1393" },
      // free and paid tiers together, day 12
      { ...base, id: ids.mixed!, slug: `itest-mixed-${run}`, name: "Itest mixed pricing", startsAt: days(12), endsAt: days(12, 20), locationType: "in_person" },
      // coordinates the organizer typed by hand: must be skipped, not crash the cast
      { ...base, id: ids.badCoords!, slug: `itest-bad-${run}`, name: "Itest bad coordinates", startsAt: days(3), endsAt: days(3, 20), locationType: "in_person", lat: "not a number", lng: "" },
      // none of these may ever surface publicly
      { ...base, id: ids.unlisted!, slug: `itest-unlisted-${run}`, name: "Itest unlisted", startsAt: days(4), endsAt: days(4, 20), visibility: "unlisted" },
      { ...base, id: ids.private!, slug: `itest-private-${run}`, name: "Itest private", startsAt: days(4), endsAt: days(4, 20), visibility: "private" },
      { ...base, id: ids.draft!, slug: `itest-draft-${run}`, name: "Itest draft", startsAt: days(4), endsAt: days(4, 20), status: "draft" },
      { ...base, id: ids.deleted!, slug: `itest-deleted-${run}`, name: "Itest deleted", startsAt: days(4), endsAt: days(4, 20), deletedAt: new Date() },
    ]);
    await database.insert(ticketTypes).values([
      { id: ulid(), eventId: ids.free!, name: "Free", priceMinor: 0, currency: "BRL" },
      { id: ulid(), eventId: ids.paid!, name: "Standard", priceMinor: 2_500, currency: "USD" },
      { id: ulid(), eventId: ids.online!, name: "Stream", priceMinor: 1_000, currency: "EUR" },
      { id: ulid(), eventId: ids.hybrid!, name: "In the room", priceMinor: 9_000, currency: "EUR" },
      { id: ulid(), eventId: ids.mixed!, name: "Supporter", priceMinor: 4_000, currency: "USD", position: 1 },
      { id: ulid(), eventId: ids.mixed!, name: "Community", priceMinor: 0, currency: "USD", position: 0 },
      // hidden tiers never define the public price
      { id: ulid(), eventId: ids.free!, name: "Secret sponsor", priceMinor: 50_000, currency: "BRL", hidden: true },
    ]);
    await database.insert(eventTags).values({ eventId: ids.free!, tagId });
  });

  afterAll(async () => {
    const all = Object.values(ids);
    await database.delete(eventTags).where(inArray(eventTags.eventId, all));
    await database.delete(ticketTypes).where(inArray(ticketTypes.eventId, all));
    await database.delete(events).where(inArray(events.id, all));
    await database.delete(tags).where(inArray(tags.id, [tagId]));
    await database.delete(organizations).where(inArray(organizations.id, [orgId]));
  });

  it("returns only public, published, live events", async () => {
    expect(names(await listPublicEvents(database, { city }))).toEqual(["badCoords", "free", "hybrid", "mixed", "online", "paid"]);
  });

  it("summarizes the cheapest visible ticket per row", async () => {
    const rows = await listPublicEvents(database, { city });
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(ids.free!)).toMatchObject({ isFree: true, minPriceMinor: 0, currency: "BRL" });
    expect(byId.get(ids.paid!)).toMatchObject({ isFree: false, minPriceMinor: 2_500, currency: "USD" });
    expect(byId.get(ids.mixed!)).toMatchObject({ isFree: false, minPriceMinor: 0, currency: "USD" });
    // no ticket types at all: nothing to charge for
    expect(byId.get(ids.badCoords!)).toMatchObject({ isFree: true, minPriceMinor: null, currency: null });
  });

  it("filters by free or paid", async () => {
    expect(names(await listPublicEvents(database, { city, price: "free" }))).toEqual(["badCoords", "free"]);
    expect(names(await listPublicEvents(database, { city, price: "paid" }))).toEqual(["hybrid", "mixed", "online", "paid"]);
  });

  it("counts hybrid events as both online and in person", async () => {
    expect(names(await listPublicEvents(database, { city, format: "online" }))).toEqual(["hybrid", "online"]);
    expect(names(await listPublicEvents(database, { city, format: "in_person" }))).toEqual(["badCoords", "free", "hybrid", "mixed", "paid"]);
  });

  it("filters by an instant range that overlaps the event", async () => {
    expect(names(await listPublicEvents(database, { city, from: days(4), to: days(6) }))).toEqual(["paid"]);
    expect(names(await listPublicEvents(database, { city, to: days(3) }))).toEqual(["badCoords", "free"]);
    expect(names(await listPublicEvents(database, { city, from: days(11) }))).toEqual(["mixed"]);
  });

  it("finds events within a radius and skips rows without usable coordinates", async () => {
    const nearby = await listPublicEvents(database, { city, near: { lat: -23.5578, lng: -46.6606, radiusKm: 25 } });
    expect(names(nearby)).toEqual(["free", "paid"]);
    expect(nearby.find((row) => row.id === ids.free)?.distanceKm).toBeCloseTo(0, 3);
    expect(nearby.find((row) => row.id === ids.paid)?.distanceKm).toBeLessThan(2);

    // Lisbon is roughly 7,900 km from São Paulo
    const wide = await listPublicEvents(database, { city, near: { lat: -23.5578, lng: -46.6606, radiusKm: 10_000 } });
    expect(names(wide)).toEqual(["free", "hybrid", "paid"]);
    expect(wide.find((row) => row.id === ids.hybrid)?.distanceKm).toBeGreaterThan(7_000);
  });

  it("filters by tag and reports tags that are actually in use", async () => {
    expect(names(await listPublicEvents(database, { city, tag: tagSlug }))).toEqual(["free"]);
    expect(await listPublicTags(database, 100)).toContainEqual({ slug: tagSlug, name: `Itest ${run}`, count: 1 });
  });

  it("paginates with limit and offset in start order", async () => {
    const all = await listPublicEvents(database, { city });
    const page = await listPublicEvents(database, { city, limit: 2, offset: 2 });
    expect(page.map((row) => row.id)).toEqual(all.slice(2, 4).map((row) => row.id));
    expect(all.map((row) => row.startsAt.getTime())).toEqual([...all.map((row) => row.startsAt.getTime())].sort((a, b) => a - b));
  });

  it("keeps unlisted, private, draft and deleted events out of the sitemap", async () => {
    const indexable = await listIndexableEvents(database);
    const slugs = indexable.map((row) => row.slug);
    expect(slugs).toContain(`itest-free-${run}`);
    for (const hidden of ["unlisted", "private", "draft", "deleted"]) expect(slugs).not.toContain(`itest-${hidden}-${run}`);
    expect((await listIndexableOrganizations(database)).map((row) => row.slug)).toContain(orgSlug);
  });
});
