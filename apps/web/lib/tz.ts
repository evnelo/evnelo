/** Offset of `tz` from UTC at `date`, in ms. */
export function tzOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "YYYY-MM-DDTHH:mm" typed as wall-clock time in `tz` → the UTC instant. */
export function zonedLocalToUtc(local: string, tz: string): Date {
  const [d = "", t = "00:00"] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh = 0, mm = 0] = t.split(":").map(Number);
  const naive = Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1, hh, mm);
  let guess = naive;
  for (let i = 0; i < 2; i++) guess = naive - tzOffsetMs(new Date(guess), tz); // converge across DST edges
  return new Date(guess);
}

/** UTC instant → "YYYY-MM-DDTHH:mm" wall-clock in `tz`, for datetime-local inputs. */
export function utcToZonedLocal(date: Date, tz: string): string {
  return new Date(date.getTime() + tzOffsetMs(date, tz)).toISOString().slice(0, 16);
}

export const TIMEZONES: string[] = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];
