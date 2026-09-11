import { describe, expect, it } from "vitest";
import { computeOrder } from "../fees";
import { discountCodeInput, discountProblem, toDiscount } from "../services/discounts";

describe("discount codes", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  it("validates and normalises input", () => {
    expect(discountCodeInput.parse({ code: " early-bird ", kind: "percent", value: "20" })).toMatchObject({ code: "EARLY-BIRD", kind: "percent", value: 20 });
    expect(discountCodeInput.safeParse({ code: "X", kind: "percent", value: 10 }).success).toBe(false);
    expect(discountCodeInput.safeParse({ code: "TOOMUCH", kind: "percent", value: 150 }).success).toBe(false);
    expect(discountCodeInput.safeParse({ code: "FIXED", kind: "fixed", value: 500, maxUses: 10, expiresAt: "2026-12-01T00:00:00Z" }).success).toBe(true);
  });
  it("reports why a code cannot be used", () => {
    expect(discountProblem(null, now)).toBe("not_found");
    expect(discountProblem({ uses: 0, maxUses: null, expiresAt: null }, now)).toBeNull();
    expect(discountProblem({ uses: 3, maxUses: 3, expiresAt: null }, now)).toBe("exhausted");
    expect(discountProblem({ uses: 0, maxUses: null, expiresAt: new Date("2026-09-10T11:00:00Z") }, now)).toBe("expired");
  });
  it("feeds the fee engine", () => {
    const lines = [{ unitPriceMinor: 2500, quantity: 2, taxRateBps: 0 }];
    const percent = computeOrder(lines, { edition: "self_hosted", feePassThrough: false, discount: toDiscount({ kind: "percent", value: 20 }) });
    expect(percent.discountMinor).toBe(1000);
    expect(percent.totalMinor).toBe(4000);
    const fixed = computeOrder(lines, { edition: "self_hosted", feePassThrough: false, discount: toDiscount({ kind: "fixed", value: 9999 }) });
    expect(fixed.discountMinor).toBe(5000); // capped at the subtotal: a 100% discount makes the order free
    expect(fixed.totalMinor).toBe(0);
  });
});
