import { describe, expect, it } from "vitest";
import { stripe } from "./stripe";
import { verifyStripeWebhook } from "./stripe-webhook";

describe("Stripe webhook destinations", () => {
  const platform = "whsec_platform_test";
  const connect = "whsec_connect_test";
  const payload = JSON.stringify({ id: "evt_test", type: "payment_intent.succeeded", account: "acct_test", data: { object: { id: "pi_test" } } });
  const signature = (secret: string) => stripe.webhooks.generateTestHeaderString({ payload, secret });

  it("verifies signatures from either configured destination", () => {
    for (const secret of [platform, connect]) {
      expect(verifyStripeWebhook(payload, signature(secret), [platform, connect]).account).toBe("acct_test");
    }
    expect(verifyStripeWebhook(payload, signature(connect), [undefined, connect]).id).toBe("evt_test");
  });

  it("fails closed on missing secrets, wrong signatures and modified bodies", () => {
    expect(() => verifyStripeWebhook(payload, signature(connect), [])).toThrow();
    expect(() => verifyStripeWebhook(payload, signature("other"), [platform, connect])).toThrow();
    expect(() => verifyStripeWebhook(payload + " ", signature(connect), [platform, connect])).toThrow();
  });
});
