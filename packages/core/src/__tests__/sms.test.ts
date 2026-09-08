import { describe, expect, it } from "vitest";
import { smsGate } from "../sms";

const base = { smsConfigured: true, attendeeMessageCount: 0, unlocked: false };

describe("smsGate", () => {
  it("self-hosted with keys is always allowed", () => {
    expect(smsGate({ ...base, edition: "self_hosted", eventIsPaid: false })).toEqual({ allowed: true });
  });
  it("cloud paid events include SMS", () => {
    expect(smsGate({ ...base, edition: "cloud", eventIsPaid: true })).toEqual({ allowed: true });
  });
  it("cloud free events need the $5 unlock", () => {
    expect(smsGate({ ...base, edition: "cloud", eventIsPaid: false })).toMatchObject({ allowed: false, reason: "needs_unlock", unlockPriceMinor: 500 });
    expect(smsGate({ ...base, edition: "cloud", eventIsPaid: false, unlocked: true })).toEqual({ allowed: true });
  });
  it("enforces fair use", () => {
    expect(smsGate({ ...base, edition: "cloud", eventIsPaid: true, attendeeMessageCount: 5 })).toMatchObject({ reason: "fair_use_exceeded" });
  });
});
