import { describe, expect, it } from "vitest";
import {
  PUBLIC_API_GLOBAL_BUCKET,
  apiJson,
  publicRateLimitBucket,
  rateLimitHeaders,
  readJsonBody,
} from "./api-http";

describe("API HTTP boundaries", () => {
  it("parses a bounded JSON request", async () => {
    const request = new Request("https://example.test/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Event" }),
    });

    await expect(readJsonBody(request, 1024)).resolves.toEqual({ name: "Event" });
  });

  it("rejects a declared body larger than the configured maximum", async () => {
    const request = new Request("https://example.test/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "1025" },
      body: "{}",
    });

    await expect(readJsonBody(request, 1024)).rejects.toMatchObject({
      status: 413,
      code: "payload_too_large",
    });
  });

  it("rejects a streamed body that exceeds the configured maximum", async () => {
    const request = new Request("https://example.test/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "too large" }),
    });

    await expect(readJsonBody(request, 8)).rejects.toMatchObject({
      status: 413,
      code: "payload_too_large",
    });
  });

  it("rejects invalid JSON and unsupported media types", async () => {
    const invalid = new Request("https://example.test/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    const wrongType = new Request("https://example.test/api/v1/events", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });

    await expect(readJsonBody(invalid, 1024)).rejects.toMatchObject({ status: 400, code: "invalid_json" });
    await expect(readJsonBody(wrongType, 1024)).rejects.toMatchObject({ status: 415, code: "unsupported_media_type" });
  });

  it("ignores forwarding headers until one trusted proxy header is configured", () => {
    const first = new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" } });
    const same = new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.8" } });
    const other = new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.9" } });

    expect(publicRateLimitBucket(first)).toBe(publicRateLimitBucket(same));
    expect(publicRateLimitBucket(first)).toBe(publicRateLimitBucket(other));
    expect(publicRateLimitBucket(first)).toHaveLength(26);
    expect(publicRateLimitBucket(first)).not.toContain("203.0.113.8");
    expect(PUBLIC_API_GLOBAL_BUCKET).toHaveLength(26);
    expect(PUBLIC_API_GLOBAL_BUCKET).not.toBe(publicRateLimitBucket(first));
  });

  it("uses only the explicitly configured trusted proxy header", () => {
    const first = new Request("https://example.test", { headers: { "cf-connecting-ip": "192.0.2.1", "x-forwarded-for": "203.0.113.8, 10.0.0.1" } });
    const same = new Request("https://example.test", { headers: { "cf-connecting-ip": "192.0.2.2", "x-forwarded-for": "203.0.113.8" } });
    const other = new Request("https://example.test", { headers: { "cf-connecting-ip": "192.0.2.1", "x-forwarded-for": "203.0.113.9" } });

    expect(publicRateLimitBucket(first, "x-forwarded-for")).toBe(publicRateLimitBucket(same, "x-forwarded-for"));
    expect(publicRateLimitBucket(first, "x-forwarded-for")).not.toBe(publicRateLimitBucket(other, "x-forwarded-for"));
  });

  it("formats standard rate-limit headers", () => {
    expect(rateLimitHeaders({ limit: 60, remaining: 42, resetAt: new Date("2030-01-02T03:05:00.000Z") })).toEqual({
      "X-RateLimit-Limit": "60",
      "X-RateLimit-Remaining": "42",
      "X-RateLimit-Reset": "2030-01-02T03:05:00.000Z",
    });
  });

  it("adds rate-limit headers without discarding response headers", async () => {
    const response = apiJson(
      { error: { code: "validation_error", message: "Invalid request." } },
      { status: 422, headers: { "X-Request-Header": "preserved" } },
      { limit: 60, remaining: 41, resetAt: new Date("2030-01-02T03:05:00.000Z") },
    );

    expect(response.status).toBe(422);
    expect(response.headers.get("x-ratelimit-remaining")).toBe("41");
    expect(response.headers.get("x-request-header")).toBe("preserved");
    await expect(response.json()).resolves.toEqual({ error: { code: "validation_error", message: "Invalid request." } });
  });
});
