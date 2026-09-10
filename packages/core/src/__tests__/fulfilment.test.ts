import { describe, expect, it } from "vitest";
import { canMarkOrderPaid } from "../services/fulfilment";

describe("paid-order fulfilment eligibility", () => {
  const now = new Date("2030-01-01T00:10:00.000Z");

  it("requires a pending order to still be inside its hold deadline", () => {
    expect(canMarkOrderPaid("pending", new Date("2030-01-01T00:10:01.000Z"), now)).toBe(true);
    expect(canMarkOrderPaid("pending", new Date("2030-01-01T00:10:00.000Z"), now)).toBe(false);
    expect(canMarkOrderPaid("pending", null, now)).toBe(false);
  });

  it("allows an already-verified processing payment to settle after the short hold", () => {
    expect(canMarkOrderPaid("processing", null, now)).toBe(true);
    expect(canMarkOrderPaid("expired", new Date("2031-01-01T00:00:00.000Z"), now)).toBe(false);
    expect(canMarkOrderPaid("failed", new Date("2031-01-01T00:00:00.000Z"), now)).toBe(false);
  });
});
