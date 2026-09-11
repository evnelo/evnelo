import { describe, expect, it } from "vitest";
import { eventInviteInput, inviteStatus, newInviteToken } from "../services/invites";

describe("event invites", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  it("reports validity from uses and expiry", () => {
    expect(inviteStatus({ uses: 0, maxUses: 1, expiresAt: null }, now)).toBe("valid");
    expect(inviteStatus({ uses: 1, maxUses: 1, expiresAt: null }, now)).toBe("exhausted");
    expect(inviteStatus({ uses: 0, maxUses: 5, expiresAt: new Date("2026-09-10T11:59:59Z") }, now)).toBe("expired");
    expect(inviteStatus({ uses: 4, maxUses: 5, expiresAt: new Date("2026-09-11T00:00:00Z") }, now)).toBe("valid");
  });
  it("normalises input", () => {
    expect(eventInviteInput.parse({ email: " Ana@Example.com ", maxUses: "3", expiresInDays: "7" })).toEqual({ email: "ana@example.com", maxUses: 3, expiresInDays: 7 });
    expect(eventInviteInput.parse({})).toEqual({ maxUses: 1 });
    expect(eventInviteInput.safeParse({ email: "nope" }).success).toBe(false);
    expect(eventInviteInput.safeParse({ maxUses: 0 }).success).toBe(false);
  });
  it("mints url-safe tokens", () => {
    const t = newInviteToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(newInviteToken()).not.toBe(t);
  });
});
