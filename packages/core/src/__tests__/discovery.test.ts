import { describe, expect, it } from "vitest";
import {
  DEFAULT_RADIUS_KM,
  addDays,
  addMonths,
  calendarMonth,
  daysInMonth,
  discoverDateRange,
  discoverHref,
  discoverParams,
  eventDayKeys,
  groupEventsByDay,
  hasActiveFilters,
  parseDiscoverFilters,
  zonedDayEnd,
  zonedDayKey,
  zonedDayStart,
} from "../discovery";

describe("discovery filter parsing", () => {
  it("reads every supported filter out of the URL", () => {
    const filters = parseDiscoverFilters({
      q: " design systems ", city: "São Paulo", tag: "design", date: "custom", from: "2026-10-01", to: "2026-10-31",
      price: "free", format: "online", lat: "-23.5578", lng: "-46.6606", radius: "5", tz: "America/Sao_Paulo",
      view: "calendar", month: "2026-10", offset: "48",
    });
    expect(filters).toMatchObject({
      q: "design systems", city: "São Paulo", tag: "design", date: "custom", from: "2026-10-01", to: "2026-10-31",
      price: "free", format: "online", lat: -23.5578, lng: -46.6606, radiusKm: 5, tz: "America/Sao_Paulo",
      view: "calendar", month: "2026-10", offset: 48,
    });
  });

  it("falls back to defaults for missing, unknown and malformed values", () => {
    const filters = parseDiscoverFilters({ price: "cheap", format: "hybrid", view: "map", date: "next-year", month: "2026-13", offset: "-5", radius: "0", tz: "Mars/Olympus" });
    expect(filters).toEqual({
      q: null, city: null, tag: null, date: null, from: null, to: null, price: null, format: null,
      lat: null, lng: null, radiusKm: DEFAULT_RADIUS_KM, tz: "UTC", view: "list", month: null, offset: 0,
    });
  });

  it("keeps custom dates only when the custom preset is selected", () => {
    expect(parseDiscoverFilters({ date: "week", from: "2026-10-01", to: "2026-10-31" })).toMatchObject({ date: "week", from: null, to: null });
    expect(parseDiscoverFilters({ date: "custom", from: "01/10/2026" })).toMatchObject({ from: null });
  });

  it("ignores a half-specified or out-of-range coordinate", () => {
    expect(parseDiscoverFilters({ lat: "40.7" })).toMatchObject({ lat: null, lng: null });
    expect(parseDiscoverFilters({ lat: "120", lng: "10" })).toMatchObject({ lat: null, lng: null });
    expect(parseDiscoverFilters({ lat: "nope", lng: "10" })).toMatchObject({ lat: null, lng: null });
  });

  it("treats only narrowing filters as active", () => {
    expect(hasActiveFilters(parseDiscoverFilters({ view: "calendar", offset: "24" }))).toBe(false);
    expect(hasActiveFilters(parseDiscoverFilters({ tag: "design" }))).toBe(true);
    expect(hasActiveFilters(parseDiscoverFilters({ lat: "1", lng: "2" }))).toBe(true);
  });
});

describe("discovery link building", () => {
  it("round-trips filters through the query string", () => {
    const params = { q: "jazz", city: "Lisbon", tag: "music", price: "paid", format: "in_person", view: "calendar", month: "2026-11" };
    expect(parseDiscoverFilters(Object.fromEntries(discoverParams(parseDiscoverFilters(params))))).toMatchObject(parseDiscoverFilters(params));
  });

  it("drops empty and default values so shared URLs stay clean", () => {
    expect(discoverHref(parseDiscoverFilters({}))).toBe("/discover");
    expect(discoverHref(parseDiscoverFilters({ lat: "1.5", lng: "2.5", radius: String(DEFAULT_RADIUS_KM) }))).toBe("/discover?lat=1.5&lng=2.5");
    expect(discoverHref(parseDiscoverFilters({ view: "list", offset: "0" }))).toBe("/discover");
  });

  it("applies a patch and lets null clear a filter", () => {
    const filters = parseDiscoverFilters({ tag: "design", q: "systems", offset: "24" });
    expect(discoverHref(filters, { tag: null, offset: 0 })).toBe("/discover?q=systems");
    expect(discoverHref(filters, { tag: "music", offset: 0 })).toBe("/discover?q=systems&tag=music");
  });

  it("only carries the month on the calendar view and custom dates on the custom preset", () => {
    expect(discoverHref(parseDiscoverFilters({ month: "2026-10" }))).toBe("/discover");
    expect(discoverHref(parseDiscoverFilters({ view: "calendar", month: "2026-10" }))).toBe("/discover?view=calendar&month=2026-10");
    expect(discoverHref(parseDiscoverFilters({ date: "custom", from: "2026-10-01" }), { date: "today" })).toBe("/discover?date=today");
  });
});

describe("zoned day maths", () => {
  it("buckets an instant into the calendar day of the given zone", () => {
    // 01:00 UTC on the 10th is still the 9th in São Paulo (UTC-3).
    expect(zonedDayKey(new Date("2026-09-10T01:00:00.000Z"), "America/Sao_Paulo")).toBe("2026-09-09");
    expect(zonedDayKey(new Date("2026-09-10T01:00:00.000Z"), "UTC")).toBe("2026-09-10");
    expect(zonedDayKey(new Date("2026-09-09T23:00:00.000Z"), "Asia/Tokyo")).toBe("2026-09-10");
  });

  it("resolves local midnight and the last millisecond of a day", () => {
    expect(zonedDayStart("2026-09-10", "America/Sao_Paulo").toISOString()).toBe("2026-09-10T03:00:00.000Z");
    expect(zonedDayEnd("2026-09-10", "America/Sao_Paulo").toISOString()).toBe("2026-09-11T02:59:59.999Z");
    expect(zonedDayStart("2026-09-10", "UTC").toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  it("lands on the right side of a spring-forward transition", () => {
    // US DST starts 2026-03-08; local midnight is still 05:00 UTC.
    expect(zonedDayStart("2026-03-08", "America/New_York").toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(zonedDayStart("2026-03-09", "America/New_York").toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("adds days and months across boundaries", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(daysInMonth("2024-02")).toBe(29);
    expect(daysInMonth("2026-02")).toBe(28);
  });
});

describe("date presets", () => {
  const now = new Date("2026-09-10T15:00:00.000Z"); // a Thursday

  it("covers exactly the current day", () => {
    const range = discoverDateRange(parseDiscoverFilters({ date: "today" }), now);
    expect(range.from?.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(range.to?.toISOString()).toBe("2026-09-10T23:59:59.999Z");
  });

  it("runs from today to the end of the current Sunday-start week", () => {
    const range = discoverDateRange(parseDiscoverFilters({ date: "week" }), now);
    expect(range.from?.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(range.to?.toISOString()).toBe("2026-09-12T23:59:59.999Z"); // Saturday
  });

  it("runs from today to the last day of the current month", () => {
    const range = discoverDateRange(parseDiscoverFilters({ date: "month" }), now);
    expect(range.to?.toISOString()).toBe("2026-09-30T23:59:59.999Z");
  });

  it("resolves presets in the requested time zone", () => {
    const range = discoverDateRange(parseDiscoverFilters({ date: "today", tz: "America/Sao_Paulo" }), now);
    expect(range.from?.toISOString()).toBe("2026-09-10T03:00:00.000Z");
    expect(range.to?.toISOString()).toBe("2026-09-11T02:59:59.999Z");
  });

  it("supports open-ended custom ranges and no date filter at all", () => {
    expect(discoverDateRange(parseDiscoverFilters({ date: "custom", to: "2026-12-24" }), now)).toEqual({ to: new Date("2026-12-24T23:59:59.999Z") });
    expect(discoverDateRange(parseDiscoverFilters({ date: "custom", from: "2026-12-24" }), now)).toEqual({ from: new Date("2026-12-24T00:00:00.000Z") });
    expect(discoverDateRange(parseDiscoverFilters({}), now)).toEqual({});
  });
});

describe("calendar grid", () => {
  it("pads the month out to whole Sunday-start weeks", () => {
    const grid = calendarMonth("2026-09"); // 1 September 2026 is a Tuesday
    expect(grid.days).toHaveLength(35);
    expect(grid.days[0]?.key).toBe("2026-08-30");
    expect(grid.days[0]?.inMonth).toBe(false);
    expect(grid.days[2]).toEqual({ key: "2026-09-01", day: 1, inMonth: true });
    expect(grid.days.at(-1)?.key).toBe("2026-10-03");
    expect(grid.days.filter((d) => d.inMonth)).toHaveLength(30);
    expect(grid.previous).toBe("2026-08");
    expect(grid.next).toBe("2026-10");
  });

  it("uses six rows when the month needs them", () => {
    expect(calendarMonth("2026-08").days).toHaveLength(42); // 1 August 2026 is a Saturday
  });

  it("queries a window that covers every rendered cell plus a day of slack", () => {
    const grid = calendarMonth("2026-09");
    expect(grid.from.toISOString()).toBe("2026-08-29T00:00:00.000Z");
    expect(grid.to.toISOString()).toBe("2026-10-04T23:59:59.999Z");
  });
});

describe("calendar bucketing", () => {
  const event = (name: string, startsAt: string, endsAt: string, timezone: string) => ({ name, startsAt: new Date(startsAt), endsAt: new Date(endsAt), timezone });

  it("places an event on the day it happens in its own time zone", () => {
    expect(eventDayKeys(new Date("2026-09-11T01:00:00.000Z"), new Date("2026-09-11T03:00:00.000Z"), "America/Sao_Paulo")).toEqual(["2026-09-10"]);
    expect(eventDayKeys(new Date("2026-09-11T01:00:00.000Z"), new Date("2026-09-11T03:00:00.000Z"), "UTC")).toEqual(["2026-09-11"]);
  });

  it("spans a multi-day event across every day it runs", () => {
    expect(eventDayKeys(new Date("2026-09-10T09:00:00.000Z"), new Date("2026-09-12T17:00:00.000Z"), "UTC")).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);
  });

  it("caps a runaway range instead of filling the grid", () => {
    expect(eventDayKeys(new Date("2026-01-01T00:00:00.000Z"), new Date("2027-01-01T00:00:00.000Z"), "UTC")).toHaveLength(14);
  });

  it("groups events into day buckets in start order", () => {
    const groups = groupEventsByDay([
      event("meetup", "2026-09-10T18:00:00.000Z", "2026-09-10T21:00:00.000Z", "UTC"),
      event("summit", "2026-09-10T09:00:00.000Z", "2026-09-11T17:00:00.000Z", "UTC"),
      event("late night", "2026-09-11T01:00:00.000Z", "2026-09-11T03:00:00.000Z", "America/Sao_Paulo"),
    ]);
    expect(groups.get("2026-09-10")?.map((e) => e.name)).toEqual(["meetup", "summit", "late night"]);
    expect(groups.get("2026-09-11")?.map((e) => e.name)).toEqual(["summit"]);
    expect(groups.has("2026-09-12")).toBe(false);
  });
});
