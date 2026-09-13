import { describe, expect, it } from "vitest";
import { checkoutStripeAccount, paymentHold, paymentOutcome, paymentsConfigured, registrationSuccessMessage } from "./payment-flow";

describe("paid checkout state", () => {
  it("expires the payment UI at the inventory hold deadline", () => {
    const expiresAt = "2030-01-01T00:10:00.000Z";
    expect(paymentHold(expiresAt, new Date("2030-01-01T00:08:30.000Z"))).toEqual({ expired: false, seconds: 90 });
    expect(paymentHold(expiresAt, new Date("2030-01-01T00:10:00.000Z"))).toEqual({ expired: true, seconds: 0 });
  });

  it("uses an organization Stripe account only in the Cloud edition", () => {
    expect(checkoutStripeAccount("self_hosted", "acct_connected")).toBeNull();
    expect(checkoutStripeAccount("cloud", "acct_connected")).toBe("acct_connected");
    expect(checkoutStripeAccount("cloud", null)).toBeNull();
  });

  it("requires both Stripe keys before creating paid orders", () => {
    expect(paymentsConfigured(undefined, undefined)).toBe(false);
    expect(paymentsConfigured("sk_test", undefined)).toBe(false);
    expect(paymentsConfigured(undefined, "pk_test")).toBe(false);
    expect(paymentsConfigured("sk_test", "pk_test")).toBe(true);
  });

  it("does not treat an incomplete PaymentIntent as a completed registration", () => {
    expect(paymentOutcome("requires_payment_method")).toEqual({ state: "retry", messageKey: "payment.outcome.retry" });
    expect(paymentOutcome("requires_action")).toEqual({ state: "pending", messageKey: "payment.outcome.pending" });
  });

  it("distinguishes processing from successful payment", () => {
    expect(paymentOutcome("processing").state).toBe("processing");
    expect(paymentOutcome("succeeded").state).toBe("complete");
  });

  it("picks the final message key from approval and party state", () => {
    expect(registrationSuccessMessage(false, 1, true)).toEqual({ messageKey: "success.singlePaid", params: { count: 1 } });
    expect(registrationSuccessMessage(false, 3, true)).toEqual({ messageKey: "success.partyPaid", params: { count: 3 } });
    expect(registrationSuccessMessage(true, 1, true)).toEqual({ messageKey: "success.approvalPaid", params: { count: 1 } });
    expect(registrationSuccessMessage(true, 2, false)).toEqual({ messageKey: "success.approval", params: { count: 2 } });
    expect(registrationSuccessMessage(false, 1, false)).toEqual({ messageKey: "success.single", params: { count: 1 } });
    expect(registrationSuccessMessage(false, 4, false)).toEqual({ messageKey: "success.party", params: { count: 4 } });
  });
});
