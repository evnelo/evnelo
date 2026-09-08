import { describe, expect, it } from "vitest";
import { computeOrder, platformFee, refundedPlatformFee } from "../fees";

describe("platform fee", () => {
  it("is 0.99% on cloud paid tickets", () => {
    expect(platformFee(10_000, "cloud")).toBe(99);
    expect(platformFee(2_500, "cloud")).toBe(25);
  });
  it("is zero for free tickets and self-hosted", () => {
    expect(platformFee(0, "cloud")).toBe(0);
    expect(platformFee(10_000, "self_hosted")).toBe(0);
  });
});

describe("computeOrder", () => {
  const lines = [{ unitPriceMinor: 5_000, quantity: 2, taxRateBps: 1000 }];

  it("absorbs the fee by default", () => {
    const b = computeOrder(lines, { edition: "cloud", feePassThrough: false });
    expect(b).toMatchObject({ subtotalMinor: 10_000, taxMinor: 1_000, platformFeeMinor: 99, serviceFeeMinor: 0, totalMinor: 11_000, organizerNetMinor: 10_901 });
  });
  it("passes the fee to the buyer when enabled", () => {
    const b = computeOrder(lines, { edition: "cloud", feePassThrough: true });
    expect(b.serviceFeeMinor).toBe(99);
    expect(b.totalMinor).toBe(11_099);
    expect(b.organizerNetMinor).toBe(11_000);
  });
  it("applies discounts before fee and tax", () => {
    const b = computeOrder(lines, { edition: "cloud", feePassThrough: false, discount: { kind: "percent", value: 50 } });
    expect(b.discountMinor).toBe(5_000);
    expect(b.taxMinor).toBe(500);
    expect(b.platformFeeMinor).toBe(50);
  });
  it("never charges a fee on self-hosted", () => {
    const b = computeOrder(lines, { edition: "self_hosted", feePassThrough: true });
    expect(b.platformFeeMinor).toBe(0);
    expect(b.serviceFeeMinor).toBe(0);
  });
  it("returns the fee proportionally on partial refunds", () => {
    const b = computeOrder(lines, { edition: "cloud", feePassThrough: false });
    expect(refundedPlatformFee(b, 5_000)).toBe(50);
    expect(refundedPlatformFee(b, 10_000)).toBe(99);
  });
});
