/**
 * Discovery filters and calendar maths (PRD §5 discovery).
 *
 * Pure and browser-safe: the URL is the single source of truth for `/discover`, so parsing,
 * link building and calendar bucketing all live here and are shared by the page, the public
 * REST endpoint and the tests. Nothing in this file touches the database.
 */

export const DISCOVER_VIEWS = ["list", "calendar"] as const;
export type DiscoverView = (typeof DISCOVER_VIEWS)[number];

export const DISCOVER_DATES = ["today", "week", "month", "custom"] as const;
export type DiscoverDate = (typeof DISCOVER_DATES)[number];

export const DISCOVER_PRICES = ["free", "paid"] as const;
export type DiscoverPrice = (typeof DISCOVER_PRICES)[number];

export const DISCOVER_FORMATS = ["online", "in_person"] as const;
export type DiscoverFormat = (typeof DISCOVER_FORMATS)[number];

export const DISCOVER_RADII_KM = [5, 25, 100] as const;
export const DEFAULT_RADIUS_KM = 25;
export const DISCOVER_PAGE_SIZE = 24;

export type DiscoverFilters = {
  q: string | null;
  city: string | null;
  tag: string | null;
  date: DiscoverDate | null;
  /** "YYYY-MM-DD" wall-clock day, only meaningful when `date` is "custom". */
  from: string | null;
  to: string | null;
  price: DiscoverPrice | null;
  format: DiscoverFormat | null;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  /** IANA zone the date presets and the calendar month are resolved in. Defaults to UTC. */
  tz: string;
  view: DiscoverView;
  /** "YYYY-MM", only used by the calendar view. */
  month: string | null;
  offset: number;
};

export type SearchParamRecord = Record<string, string | string[] | undefined>;

/* ---------- time zone primitives ---------- */

const DAY_MS = 86_400_000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Offset of `timeZone` from UTC at `date`, in milliseconds. */
export function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(date.getTime() / 1000) * 1000;
}

/** The calendar day an instant falls on, as "YYYY-MM-DD" in `timeZone`. */
export function zonedDayKey(date: Date, timeZone: string): string {
  return new Date(date.getTime() + zoneOffsetMs(date, timeZone)).toISOString().slice(0, 10);
}

/** The UTC instant of local midnight starting `dayKey` ("YYYY-MM-DD") in `timeZone`. */
export function zonedDayStart(dayKey: string, timeZone: string): Date {
  const [y = 1970, m = 1, d = 1] = dayKey.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d);
  let guess = naive;
  for (let i = 0; i < 2; i++) guess = naive - zoneOffsetMs(new Date(guess), timeZone); // converge across DST edges
  return new Date(guess);
}

/** The last instant of `dayKey` in `timeZone` (local midnight of the next day, minus a millisecond). */
export function zonedDayEnd(dayKey: string, timeZone: string): Date {
  return new Date(zonedDayStart(addDays(dayKey, 1), timeZone).getTime() - 1);
}

/** Calendar arithmetic on "YYYY-MM-DD" keys. Days are pure dates here, so UTC maths is exact. */
export function addDays(dayKey: string, days: number): string {
  return new Date(Date.parse(`${dayKey}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Day of the week for a "YYYY-MM-DD" key, 0 = Sunday. */
export function dayOfWeek(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00.000Z`).getUTCDay();
}

export function monthOf(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y = 1970, m = 1] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [y = 1970, m = 1] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/* ---------- parsing ---------- */

function one(params: SearchParamRecord, key: string): string | null {
  const value = params[key];
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

function member<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function coordinate(value: string | null, max: number): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= max ? Math.round(parsed * 1e6) / 1e6 : null;
}

/** Read `/discover` search params into filters. Unknown or malformed values fall back to defaults. */
export function parseDiscoverFilters(params: SearchParamRecord): DiscoverFilters {
  const date = member(one(params, "date"), DISCOVER_DATES);
  const day = (key: string) => {
    const value = one(params, key);
    return value !== null && DAY_KEY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) ? value : null;
  };
  const lat = coordinate(one(params, "lat"), 90);
  const lng = coordinate(one(params, "lng"), 180);
  const near = lat !== null && lng !== null;
  const radius = Number(one(params, "radius"));
  const tz = one(params, "tz");
  const month = one(params, "month");
  const offset = Number(one(params, "offset"));

  return {
    q: one(params, "q")?.slice(0, 160) ?? null,
    city: one(params, "city")?.slice(0, 100) ?? null,
    tag: one(params, "tag")?.slice(0, 60) ?? null,
    date,
    from: date === "custom" ? day("from") : null,
    to: date === "custom" ? day("to") : null,
    price: member(one(params, "price"), DISCOVER_PRICES),
    format: member(one(params, "format"), DISCOVER_FORMATS),
    lat: near ? lat : null,
    lng: near ? lng : null,
    radiusKm: Number.isFinite(radius) && radius > 0 && radius <= 500 ? Math.round(radius) : DEFAULT_RADIUS_KM,
    tz: tz !== null && isValidTimeZone(tz) ? tz : "UTC",
    view: member(one(params, "view"), DISCOVER_VIEWS) ?? "list",
    month: month !== null && MONTH_KEY.test(month) ? month : null,
    offset: Number.isFinite(offset) && offset > 0 ? Math.min(Math.floor(offset), 5_000) : 0,
  };
}

/** True when the visitor narrowed the default feed, so featured/upcoming sections give way to results. */
export function hasActiveFilters(filters: DiscoverFilters): boolean {
  return Boolean(filters.q || filters.city || filters.tag || filters.date || filters.price || filters.format || filters.lat !== null);
}

/* ---------- link building ---------- */

export type DiscoverPatch = Partial<Omit<DiscoverFilters, "radiusKm" | "offset">> & { radiusKm?: number | null; offset?: number | null };

/** Rebuild the query string from filters plus an override patch. Empty and default values are dropped. */
export function discoverParams(filters: DiscoverFilters, patch: DiscoverPatch = {}): URLSearchParams {
  const merged = { ...filters, ...patch };
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | null | undefined, fallback?: string | number) => {
    if (value === null || value === undefined || value === "" || value === fallback) return;
    params.set(key, String(value));
  };
  set("q", merged.q);
  set("city", merged.city);
  set("tag", merged.tag);
  set("date", merged.date);
  if (merged.date === "custom") {
    set("from", merged.from);
    set("to", merged.to);
  }
  set("price", merged.price);
  set("format", merged.format);
  if (merged.lat !== null && merged.lat !== undefined && merged.lng !== null && merged.lng !== undefined) {
    set("lat", merged.lat);
    set("lng", merged.lng);
    set("radius", merged.radiusKm ?? DEFAULT_RADIUS_KM, DEFAULT_RADIUS_KM);
  }
  set("tz", merged.tz, "UTC");
  set("view", merged.view, "list");
  if (merged.view === "calendar") set("month", merged.month);
  set("offset", merged.offset ?? 0, 0);
  return params;
}

export function discoverHref(filters: DiscoverFilters, patch: DiscoverPatch = {}, basePath = "/discover"): string {
  const query = discoverParams(filters, patch).toString();
  return query ? `${basePath}?${query}` : basePath;
}

/* ---------- date ranges ---------- */

export type DiscoverRange = { from?: Date; to?: Date };

/**
 * Resolve the date filter into an instant range.
 * "This week" runs to the end of the current Sunday-start calendar week; "this month" to the
 * last day of the current calendar month. Both start today, because past events never surface.
 */
export function discoverDateRange(filters: DiscoverFilters, now: Date): DiscoverRange {
  const tz = filters.tz;
  const today = zonedDayKey(now, tz);
  switch (filters.date) {
    case "today":
      return { from: zonedDayStart(today, tz), to: zonedDayEnd(today, tz) };
    case "week":
      return { from: zonedDayStart(today, tz), to: zonedDayEnd(addDays(today, 6 - dayOfWeek(today)), tz) };
    case "month": {
      const month = monthOf(today);
      return { from: zonedDayStart(today, tz), to: zonedDayEnd(`${month}-${String(daysInMonth(month)).padStart(2, "0")}`, tz) };
    }
    case "custom": {
      const range: DiscoverRange = {};
      if (filters.from) range.from = zonedDayStart(filters.from, tz);
      if (filters.to) range.to = zonedDayEnd(filters.to, tz);
      return range;
    }
    default:
      return {};
  }
}

/* ---------- calendar ---------- */

export type CalendarDay = { key: string; day: number; inMonth: boolean };
export type CalendarMonth = {
  month: string;
  previous: string;
  next: string;
  days: CalendarDay[];
  /** Instant window covering every rendered cell, padded a day each side so zone shifts never drop an event. */
  from: Date;
  to: Date;
};

/** A Sunday-start month grid of whole weeks, plus the instant range needed to fill it. */
export function calendarMonth(month: string, timeZone = "UTC"): CalendarMonth {
  const first = `${month}-01`;
  const lead = dayOfWeek(first);
  const cells = Math.ceil((lead + daysInMonth(month)) / 7) * 7;
  const start = addDays(first, -lead);
  const days: CalendarDay[] = [];
  for (let i = 0; i < cells; i++) {
    const key = addDays(start, i);
    days.push({ key, day: Number(key.slice(8)), inMonth: monthOf(key) === month });
  }
  return {
    month,
    previous: addMonths(month, -1),
    next: addMonths(month, 1),
    days,
    from: zonedDayStart(addDays(start, -1), timeZone),
    to: zonedDayEnd(addDays(start, cells), timeZone),
  };
}

/**
 * Every calendar day an event covers, in the event's own time zone, so a Friday-night event in
 * São Paulo lands on Friday for everyone looking at the grid. The end instant is exclusive: a
 * party that runs until midnight belongs to the night it started, not to the morning after.
 */
export function eventDayKeys(startsAt: Date, endsAt: Date, timeZone: string, maxDays = 14): string[] {
  const first = zonedDayKey(startsAt, timeZone);
  const last = zonedDayKey(new Date(Math.max(endsAt.getTime() - 1, startsAt.getTime())), timeZone);
  const keys = [first];
  for (let key = first; key !== last && keys.length < maxDays; ) {
    key = addDays(key, 1);
    keys.push(key);
  }
  return keys;
}

/** Bucket events into "YYYY-MM-DD" cells. Multi-day events appear on every day they run. */
export function groupEventsByDay<T extends { startsAt: Date; endsAt: Date; timezone: string }>(events: readonly T[]): Map<string, T[]> {
  const byDay = new Map<string, T[]>();
  for (const event of events) {
    for (const key of eventDayKeys(event.startsAt, event.endsAt, event.timezone)) {
      const bucket = byDay.get(key);
      if (bucket) bucket.push(event);
      else byDay.set(key, [event]);
    }
  }
  return byDay;
}
