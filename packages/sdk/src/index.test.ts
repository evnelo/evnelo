import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WEBHOOK_SIGNATURE_HEADER, WEBHOOK_TIMESTAMP_HEADER, apiBaseUrl, createOpenTicketClient, signWebhook, verifyWebhookRequest, verifyWebhookSignature, type Schemas } from "./index";

function mockFetch(body: unknown, status = 200) {
  const calls: Request[] = [];
  const fetch = async (request: Request) => {
    calls.push(request);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return { calls, fetch };
}

describe("createOpenTicketClient", () => {
  it("prefixes /api/v1, sends the bearer key, and types paths and responses from the schema", async () => {
    const page = { data: [], pagination: { limit: 10, offset: 0, nextOffset: null } };
    const { calls, fetch } = mockFetch(page);
    const client = createOpenTicketClient({ baseUrl: "https://tickets.example.com/", apiKey: "ot_live_test", fetch });

    const { data, error } = await client.GET("/events", { params: { query: { status: "published", limit: 10 } } });
    expect(error).toBeUndefined();
    expect(data?.pagination.nextOffset).toBeNull();
    expect(calls[0]?.url).toBe("https://tickets.example.com/api/v1/events?status=published&limit=10");
    expect(calls[0]?.headers.get("authorization")).toBe("Bearer ot_live_test");

    const id = "01AAAAAAAAAAAAAAAAAAAAAAAA";
    await client.POST("/events/{id}/ticket-types", { params: { path: { id } }, body: { name: "General", priceMinor: 0 }, headers: { "Idempotency-Key": "abc" } });
    expect(calls[1]?.url).toBe(`https://tickets.example.com/api/v1/events/${id}/ticket-types`);
    expect(calls[1]?.method).toBe("POST");
    expect(calls[1]?.headers.get("idempotency-key")).toBe("abc");

    // compile-time contract: unknown paths and mistyped bodies are rejected
    // @ts-expect-error not a documented path
    void client.GET("/nope");
    // @ts-expect-error priceMinor must be a number
    void client.POST("/events/{id}/ticket-types", { params: { path: { id } }, body: { name: "x", priceMinor: "free" } });
    const event: Schemas["Event"] | undefined = undefined;
    expect(event).toBeUndefined();
  });

  it("surfaces documented errors as `error` with the documented shape", async () => {
    const { fetch } = mockFetch({ error: { code: "not_found", message: "Event not found." } }, 404);
    const client = createOpenTicketClient({ baseUrl: "http://localhost:3000", apiKey: "k", fetch });
    const { data, error, response } = await client.GET("/events/{id}", { params: { path: { id: "01AAAAAAAAAAAAAAAAAAAAAAAA" } } });
    expect(data).toBeUndefined();
    expect(error?.error.code).toBe("not_found");
    expect(response.status).toBe(404);
  });

  it("does not add the prefix twice", () => {
    expect(apiBaseUrl("https://x.test")).toBe("https://x.test/api/v1");
    expect(apiBaseUrl("https://x.test/api/v1/")).toBe("https://x.test/api/v1");
  });
});

describe("verifyWebhookSignature", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ id: "d1", type: "order.paid", createdAt: "2026-01-01T00:00:00.000Z", organizationId: "o", data: { orderId: "x" } });

  it("matches HMAC-SHA256 over {timestamp}.{body} within the replay window", () => {
    const ts = Math.floor(Date.now() / 1000);
    const expected = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    expect(signWebhook(secret, ts, body)).toBe(expected);
    expect(verifyWebhookSignature(secret, ts, body, expected)).toBe(true);
    expect(verifyWebhookSignature(secret, ts, body, `v1=${expected}`)).toBe(true);
    expect(verifyWebhookSignature(secret, ts, `${body} `, expected)).toBe(false);
    expect(verifyWebhookSignature("other", ts, body, expected)).toBe(false);
    expect(verifyWebhookSignature(secret, ts - 600, body, signWebhook(secret, ts - 600, body))).toBe(false);
    expect(verifyWebhookSignature(secret, "nan", body, expected)).toBe(false);
  });

  it("verifies straight from headers and parses the envelope", () => {
    const ts = Math.floor(Date.now() / 1000);
    const headers = new Headers({ [WEBHOOK_SIGNATURE_HEADER]: signWebhook(secret, ts, body), [WEBHOOK_TIMESTAMP_HEADER]: String(ts) });
    expect(verifyWebhookRequest<{ orderId: string }>(secret, headers, body)?.data.orderId).toBe("x");
    expect(verifyWebhookRequest(secret, new Headers(), body)).toBeNull();
  });
});
