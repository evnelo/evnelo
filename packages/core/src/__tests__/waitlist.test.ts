import { describe, expect, it } from "vitest";
import { offerIsOpen, waitlistJoinInput, waitlistStatus } from "../services/waitlist";

describe("waitlist status", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  const base = { registeredAt: null, holdExpiresAt: null, expiredAt: null, promotedAt: null };
  it("derives the state from the timestamps", () => {
    expect(waitlistStatus(base, now)).toBe("waiting");
    expect(waitlistStatus({ ...base, promotedAt: now, holdExpiresAt: new Date("2026-09-11T12:00:00Z") }, now)).toBe("offered");
    expect(waitlistStatus({ ...base, promotedAt: now, holdExpiresAt: new Date("2026-09-10T11:00:00Z") }, now)).toBe("expired");
    expect(waitlistStatus({ ...base, promotedAt: now, holdExpiresAt: new Date("2026-09-11T12:00:00Z"), expiredAt: now }, now)).toBe("expired");
    expect(waitlistStatus({ ...base, promotedAt: now, registeredAt: now }, now)).toBe("registered");
  });
  it("only open offers with a seat can be used", () => {
    const entry = { id: "e", eventId: "ev", ticketTypeId: "tt", email: "a@b.c", name: "A", token: "t", createdAt: now, orderId: null, ...base, promotedAt: now, holdExpiresAt: new Date("2026-09-11T12:00:00Z") };
    expect(offerIsOpen(entry, now)).toBe(true);
    expect(offerIsOpen({ ...entry, ticketTypeId: null }, now)).toBe(false);
    expect(offerIsOpen({ ...entry, registeredAt: now }, now)).toBe(false);
    expect(offerIsOpen(null, now)).toBe(false);
  });
  it("normalises the join form", () => {
    expect(waitlistJoinInput.parse({ name: " Ana ", email: " ANA@Example.com " })).toEqual({ name: "Ana", email: "ana@example.com" });
    expect(waitlistJoinInput.safeParse({ name: "", email: "x" }).success).toBe(false);
  });
});
