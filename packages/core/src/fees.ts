/**
 * Fee model:
 *  - free tickets: no platform fee
 *  - paid tickets on Cloud: 0.99% of gross ticket price
 *  - self-hosted: no platform fee, ever
 *  - organizer chooses to absorb the fee or pass it through as a "Service fee" line
 * Stripe's own processing fee is never computed here: it is charged by Stripe on
 * whichever account runs the charge (organizer's connected account, or ours).
 */
import type { Edition } from "./edition";

export const PLATFORM_FEE_BPS = 99; // 0.99%
export const SMS_UNLOCK_PRICE_MINOR = 500; // $5.00

export type LineInput = { unitPriceMinor: number; quantity: number; taxRateBps?: number };

export type FeeBreakdown = {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  platformFeeMinor: number; // what the platform keeps
  serviceFeeMinor: number; // what the buyer sees as a line item (0 when absorbed)
  totalMinor: number; // what the buyer pays
  organizerNetMinor: number; // before Stripe processing fees
};

export type Discount = { kind: "percent"; value: number } | { kind: "fixed"; value: number } | null;

export function platformFee(grossMinor: number, edition: Edition): number {
  if (edition !== "cloud" || grossMinor <= 0) return 0;
  return Math.round((grossMinor * PLATFORM_FEE_BPS) / 10_000);
}

export function computeOrder(
  lines: LineInput[],
  opts: { edition: Edition; feePassThrough: boolean; discount?: Discount },
): FeeBreakdown {
  const subtotalMinor = lines.reduce((s, l) => s + l.unitPriceMinor * l.quantity, 0);

  let discountMinor = 0;
  if (opts.discount?.kind === "percent") discountMinor = Math.round((subtotalMinor * opts.discount.value) / 100);
  if (opts.discount?.kind === "fixed") discountMinor = opts.discount.value;
  discountMinor = Math.min(discountMinor, subtotalMinor);

  const discountedGross = subtotalMinor - discountMinor;
  // tax is applied proportionally after discount
  const taxMinor = lines.reduce((s, l) => {
    const lineGross = l.unitPriceMinor * l.quantity;
    const share = subtotalMinor === 0 ? 0 : lineGross / subtotalMinor;
    const lineDiscounted = discountedGross * share;
    return s + Math.round((lineDiscounted * (l.taxRateBps ?? 0)) / 10_000);
  }, 0);

  const platformFeeMinor = platformFee(discountedGross, opts.edition);
  const serviceFeeMinor = opts.feePassThrough ? platformFeeMinor : 0;
  const totalMinor = discountedGross + taxMinor + serviceFeeMinor;
  const organizerNetMinor = totalMinor - platformFeeMinor;

  return { subtotalMinor, discountMinor, taxMinor, platformFeeMinor, serviceFeeMinor, totalMinor, organizerNetMinor };
}

/** Platform fee to return on a (partial) refund, proportional to the refunded gross. */
export function refundedPlatformFee(breakdown: FeeBreakdown, refundGrossMinor: number): number {
  const gross = breakdown.subtotalMinor - breakdown.discountMinor;
  if (gross <= 0) return 0;
  return Math.round((breakdown.platformFeeMinor * Math.min(refundGrossMinor, gross)) / gross);
}
