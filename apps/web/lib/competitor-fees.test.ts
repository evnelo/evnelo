import { describe, expect, it } from "vitest";
import { COMPARISONS, feePerTicket, isComparePage } from "./competitor-fees";

describe("competitor fees", () => {
  it("matches each platform's published examples", () => {
    expect(feePerTicket("evnelo", 2500)).toBe(25); // "A $25 ticket costs you 25 cents"
    expect(feePerTicket("eventbrite", 5000)).toBe(364); // 3.7% of $50 + $1.79
    expect(feePerTicket("lumaFree", 2000)).toBe(100);
    expect(feePerTicket("lumaPlus", 2000)).toBe(0);
  });

  it("applies Sympla's R$3.99 minimum up to R$39.90", () => {
    expect(feePerTicket("sympla", 2000)).toBe(399);
    expect(feePerTicket("sympla", 3990)).toBe(399);
    expect(feePerTicket("sympla", 10000)).toBe(1000);
  });

  it("charges nothing on free tickets", () => {
    for (const platform of ["evnelo", "eventbrite", "lumaFree", "lumaPlus", "sympla"] as const) expect(feePerTicket(platform, 0)).toBe(0);
  });

  it("puts Evnelo first in every comparison and only routes the English pages", () => {
    for (const row of Object.values(COMPARISONS)) expect(row[0]).toBe("evnelo");
    expect(isComparePage("eventbrite")).toBe(true);
    expect(isComparePage("sympla")).toBe(false);
  });
});
