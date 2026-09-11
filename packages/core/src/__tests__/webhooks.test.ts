import { describe, expect, it } from "vitest";
import { WEBHOOK_EVENTS, webhookRetryDelayMs } from "../webhooks";
import { newWebhookSecret, signWebhook, verifyWebhookSignature, webhookInput } from "../services/webhooks";

describe("outbound webhooks", () => {
  it("signs {timestamp}.{body} and verifies within the tolerance window", () => {
    const secret = newWebhookSecret();
    const body = JSON.stringify({ id: "x", type: "order.paid" });
    const ts = Math.floor(Date.now() / 1000);
    const sig = signWebhook(secret, ts, body);
    expect(verifyWebhookSignature(secret, ts, body, sig)).toBe(true);
    expect(verifyWebhookSignature(secret, ts, body, `v1=${sig}`)).toBe(true);
    expect(verifyWebhookSignature(secret, ts, body + " ", sig)).toBe(false);
    expect(verifyWebhookSignature("other", ts, body, sig)).toBe(false);
    expect(verifyWebhookSignature(secret, ts - 600, body, signWebhook(secret, ts - 600, body))).toBe(false); // replay
  });
  it("backs off exponentially with a cap", () => {
    expect(webhookRetryDelayMs(1)).toBe(60_000);
    expect(webhookRetryDelayMs(3)).toBe(4 * 60_000);
    expect(webhookRetryDelayMs(20)).toBe(6 * 3_600_000);
  });
  it("validates subscriptions", () => {
    expect(webhookInput.safeParse({ url: "https://example.com/hook", events: ["order.paid"] }).success).toBe(true);
    expect(webhookInput.safeParse({ url: "http://example.com/hook", events: ["order.paid"] }).success).toBe(false);
    expect(webhookInput.safeParse({ url: "http://localhost:4000/hook", events: ["order.paid"] }).success).toBe(true);
    expect(webhookInput.safeParse({ url: "https://example.com/hook", events: [] }).success).toBe(false);
    expect(webhookInput.safeParse({ url: "https://example.com/hook", events: ["nope"] }).success).toBe(false);
    expect(WEBHOOK_EVENTS).toContain("attendee.checked_in");
  });
});
