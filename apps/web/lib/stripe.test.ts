import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({ env: { EDITION: "cloud", STRIPE_SECRET_KEY: "sk_test_example", STRIPE_CONNECT_CLIENT_ID: "ca_test", APP_URL: "https://evnelo.test/" } }));
import { env } from "./env";
import { connectOnboardingUrl, createOrderPaymentIntent, stripe } from "./stripe";
import { connectedAccountStatus } from "./stripe-connect";
vi.mock("./observability", () => ({ captureError: vi.fn() }));

describe("connected account payments", () => {
  beforeEach(() => { vi.restoreAllMocks(); env.EDITION = "cloud"; });
  const args = { orderId: "order-test", amountMinor: 1000, currency: "USD", platformFeeMinor: 10, receiptEmail: "test@example.com" };

  it("refuses cloud payments without an organizer account", async () => {
    const create = vi.spyOn(stripe.paymentIntents, "create");
    await expect(createOrderPaymentIntent(args)).rejects.toThrow("connected Stripe account");
    expect(create).not.toHaveBeenCalled();
  });

  it("charges the connected account and collects the platform fee", async () => {
    const create = vi.spyOn(stripe.paymentIntents, "create").mockResolvedValue({ id: "pi_test" } as never);
    await createOrderPaymentIntent({ ...args, stripeAccountId: "acct_test" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ application_fee_amount: 10, currency: "usd" }), { idempotencyKey: "order:order-test", stripeAccount: "acct_test" });
  });

  it("keeps self-hosted payments on the operator account without a fee", async () => {
    env.EDITION = "self_hosted";
    const create = vi.spyOn(stripe.paymentIntents, "create").mockResolvedValue({ id: "pi_test" } as never);
    await createOrderPaymentIntent({ ...args, stripeAccountId: "acct_ignored" });
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("application_fee_amount");
    expect(create.mock.calls[0]?.[1]).toEqual({ idempotencyKey: "order:order-test" });
    expect(() => connectOnboardingUrl("nonce")).toThrow();
  });

  it("builds the registered callback URL with an opaque state", () => {
    const url = new URL(connectOnboardingUrl("random-state"));
    expect(url.origin).toBe("https://connect.stripe.com");
    expect(url.searchParams.get("state")).toBe("random-state");
    expect(url.searchParams.get("redirect_uri")).toBe("https://evnelo.test/api/stripe/connect/callback");
    expect(url.searchParams.get("scope")).toBe("read_write");
  });

  it("checks current charge readiness and fails closed when access is revoked", async () => {
    const retrieve = vi.spyOn(stripe.accounts, "retrieve");
    expect(await connectedAccountStatus(null)).toBe("missing");
    expect(retrieve).not.toHaveBeenCalled();
    retrieve.mockResolvedValueOnce({ charges_enabled: true } as never);
    expect(await connectedAccountStatus("acct_test")).toBe("ready");
    retrieve.mockResolvedValueOnce({ charges_enabled: false } as never);
    expect(await connectedAccountStatus("acct_test")).toBe("restricted");
    retrieve.mockRejectedValueOnce(new Error("Access revoked"));
    expect(await connectedAccountStatus("acct_test")).toBe("unavailable");
  });
});
