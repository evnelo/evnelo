import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ event: {} as Record<string, unknown>, verify: vi.fn(), settle: vi.fn(), refund: vi.fn(), status: vi.fn(), updateStatus: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { EDITION: "cloud", STRIPE_SECRET_KEY: "sk_live_example", STRIPE_WEBHOOK_SECRET: "whsec_platform", STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect" } }));
vi.mock("@/lib/stripe-webhook", () => ({ verifyStripeWebhook: mocks.verify }));
vi.mock("@/lib/orders", () => ({ settlePaymentIntent: mocks.settle, applyRefund: mocks.refund, applyDispute: vi.fn() }));
vi.mock("@/lib/stripe-connect", () => ({ connectedAccountStatus: mocks.status }));
vi.mock("@evnelo/core/services", () => ({ updateStripeAccountStatus: mocks.updateStatus }));
vi.mock("@/lib/db", () => ({ db: { update: mocks.update } }));
import { POST } from "./route";

describe("Stripe connected-account webhook routing", () => {
  const intent = { id: "pi_test", metadata: {} };
  const call = () => POST(new Request("https://evnelo.test/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": "signature" }, body: "signed-body" }));
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.event = { type: "payment_intent.succeeded", livemode: true, account: "acct_connected", data: { object: intent } };
    mocks.verify.mockImplementation(() => mocks.event);
    mocks.status.mockResolvedValue("ready");
  });

  it("settles connected payments in their original account context", async () => {
    expect((await call()).status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith("signed-body", "signature", ["whsec_platform", "whsec_connect"]);
    expect(mocks.settle).toHaveBeenCalledWith(intent, "acct_connected");
  });

  it("ignores test payments at a live destination", async () => {
    mocks.event.livemode = false;
    expect((await call()).status).toBe(200);
    expect(mocks.settle).not.toHaveBeenCalled();
  });

  it("does not allow connected-account metadata to unlock platform SMS", async () => {
    mocks.event.data = { object: { ...intent, metadata: { smsUnlockEventId: "event-id" } } };
    await call();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.settle).toHaveBeenCalled();
  });

  it("applies connected-account refunds", async () => {
    mocks.event.type = "charge.refunded";
    const charge = { id: "ch_test", payment_intent: "pi_test", amount_refunded: 1000, amount: 1000 };
    mocks.event.data = { object: charge };
    await call();
    expect(mocks.refund).toHaveBeenCalledWith(charge);
  });

  it.each(["account.updated", "account.application.deauthorized"])("refreshes current readiness on %s", async (type) => {
    mocks.event.type = type;
    mocks.status.mockResolvedValue("unavailable");
    await call();
    expect(mocks.status).toHaveBeenCalledWith("acct_connected");
    expect(mocks.updateStatus).toHaveBeenCalledWith(expect.anything(), "acct_connected", false);
  });

  it("rejects an invalid signature without processing an event", async () => {
    mocks.verify.mockImplementation(() => { throw new Error("Invalid signature"); });
    expect((await call()).status).toBe(400);
    expect(mocks.settle).not.toHaveBeenCalled();
  });
});
