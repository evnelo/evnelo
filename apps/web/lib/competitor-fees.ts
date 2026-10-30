import { platformFee } from "@evnelo/core";

/**
 * Per-ticket platform fees for the comparison pages, each taken from the platform's own public pricing
 * page on the date in `PRICING_SOURCES`. Re-check the sources and bump `checked` before changing a number:
 * these figures are published claims about other companies. Card processing is left out everywhere,
 * because every platform passes it on at roughly the processor's rate; the pages say so next to the numbers.
 * Evnelo's own fee comes from core's `platformFee`, never from here.
 */

export type FeePlatform = "evnelo" | "eventbrite" | "lumaFree" | "lumaPlus" | "sympla";
export type Competitor = "eventbrite" | "luma" | "sympla";

export const PRICING_SOURCES: Record<Competitor, { url: string; checked: string; currency: string }> = {
  eventbrite: { url: "https://www.eventbrite.com/organizer/pricing/", checked: "2026-10-29", currency: "USD" },
  luma: { url: "https://luma.com/pricing", checked: "2026-10-29", currency: "USD" },
  sympla: { url: "https://produtores.sympla.com.br/quanto-custa/", checked: "2026-10-29", currency: "BRL" },
};

/** Luma Plus removes the per-ticket fee for a subscription: $59 a month, billed annually. */
export const LUMA_PLUS_MONTHLY_MINOR = 5900;

/** The platform's fee on one paid ticket of `priceMinor`, in the same minor units. Free tickets cost nothing anywhere. */
export function feePerTicket(platform: FeePlatform, priceMinor: number): number {
  if (priceMinor <= 0) return 0;
  switch (platform) {
    case "evnelo": return platformFee(priceMinor, "cloud");
    case "eventbrite": return Math.round(priceMinor * 0.037) + 179; // US: 3.7% + $1.79 per ticket
    case "lumaFree": return Math.round(priceMinor * 0.05);
    case "lumaPlus": return 0;
    case "sympla": return Math.max(Math.round(priceMinor * 0.1), 399); // 10%, at least R$3.99
  }
}

/** The platforms each comparison puts side by side, Evnelo first. */
export const COMPARISONS: Record<Competitor, FeePlatform[]> = {
  eventbrite: ["evnelo", "eventbrite"],
  luma: ["evnelo", "lumaFree", "lumaPlus"],
  sympla: ["evnelo", "sympla"],
};

/** Competitors with an English comparison page at /compare/{slug}; Sympla is covered on /brasil. */
export const COMPARE_PAGES = ["eventbrite", "luma"] as const satisfies readonly Competitor[];
export type ComparePage = (typeof COMPARE_PAGES)[number];
export const isComparePage = (value: string): value is ComparePage => (COMPARE_PAGES as readonly string[]).includes(value);
