import { describe, expect, it } from "vitest";
import { reminderSlots, reminderWhen, retryDelayMs, smsKeyword } from "../notifications";

describe("reminderSlots", () => {
  const start = new Date("2026-09-22T21:00:00Z");
  it("schedules each configured hour before the event", () => {
    const slots = reminderSlots(start, [24, 1], new Date("2026-09-20T00:00:00Z"));
    expect(slots.map((s) => s.at.toISOString())).toEqual(["2026-09-21T21:00:00.000Z", "2026-09-22T20:00:00.000Z"]);
  });
  it("drops slots that are already past, keeping a short grace window", () => {
    const slots = reminderSlots(start, [24, 1], new Date("2026-09-21T21:03:00Z"));
    expect(slots.map((s) => s.hours)).toEqual([24, 1]);
    expect(reminderSlots(start, [24, 1], new Date("2026-09-21T22:00:00Z")).map((s) => s.hours)).toEqual([1]);
  });
  it("ignores junk hours and duplicates", () => {
    expect(reminderSlots(start, [1, 1, 0, -3, NaN], new Date("2026-09-20T00:00:00Z"))).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("labels reminders", () => {
    expect(reminderWhen(24)).toBe("tomorrow");
    expect(reminderWhen(1)).toBe("in 1 hour");
    expect(reminderWhen(3)).toBe("in 3 hours");
    expect(reminderWhen(72)).toBe("in 3 days");
  });
  it("backs off exponentially and caps", () => {
    expect(retryDelayMs(1)).toBe(2 * 60_000);
    expect(retryDelayMs(3)).toBe(8 * 60_000);
    expect(retryDelayMs(10)).toBe(60 * 60_000);
  });
  it("recognises opt-out keywords in English and Portuguese", () => {
    expect(smsKeyword("STOP")).toBe("stop");
    expect(smsKeyword(" parar por favor")).toBe("stop");
    expect(smsKeyword("start")).toBe("start");
    expect(smsKeyword("see you there")).toBeNull();
  });
});
