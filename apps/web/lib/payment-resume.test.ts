import { describe, expect, it } from "vitest";
import { paymentResumeMatches, signPaymentResume, verifyPaymentResume } from "./payment-resume";

const secret = "a-test-secret-that-is-long-enough";
const payload = {
  orderId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  eventId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  expiresAt: new Date("2030-01-01T00:10:00.000Z"),
};

describe("payment resume tokens", () => {
  it("binds the token and client secret to the stored order", () => {
    const order = { id: payload.orderId, eventId: payload.eventId, stripePaymentIntentId: "pi_expected" };
    expect(paymentResumeMatches({ orderId: payload.orderId, eventId: payload.eventId }, order, "pi_expected_secret_value")).toBe(true);
    expect(paymentResumeMatches({ orderId: payload.orderId, eventId: "other" }, order, "pi_expected_secret_value")).toBe(false);
    expect(paymentResumeMatches({ orderId: payload.orderId, eventId: payload.eventId }, order, "pi_other_secret_value")).toBe(false);
  });

  it("round-trips an order bound to its event", async () => {
    const token = await signPaymentResume(payload, secret);
    await expect(verifyPaymentResume(token, secret, new Date("2030-01-01T00:05:00.000Z"))).resolves.toEqual({ orderId: payload.orderId, eventId: payload.eventId });
  });

  it("rejects tampered and expired tokens", async () => {
    const token = await signPaymentResume(payload, secret);
    const tampered = `${token.slice(0, -1)}${token.endsWith("x") ? "y" : "x"}`; // always differs from the original
    await expect(verifyPaymentResume(tampered, secret, new Date("2030-01-01T00:05:00.000Z"))).rejects.toThrow();
    await expect(verifyPaymentResume(token, secret, new Date("2030-01-01T00:11:00.000Z"))).rejects.toThrow();
  });
});
