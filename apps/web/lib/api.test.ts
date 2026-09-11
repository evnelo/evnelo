import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiRouteError, apiError, businessRule, conflict, idempotencyKey, notFound, parseQuery, parseWith } from "./api";

const rateLimit = { limit: 120, remaining: 7, resetAt: new Date("2030-01-01T00:01:00.000Z") };

describe("REST route helpers", () => {
  it("turns validation failures into 422 with the zod issues", async () => {
    const request = new Request("https://x.test/api/v1/events?limit=abc");
    const schema = z.object({ limit: z.coerce.number().int().min(1) });
    expect(() => parseQuery(request, schema)).toThrow(ApiRouteError);
    try {
      parseQuery(request, schema);
    } catch (error) {
      const response = apiError(error, { apiKeyId: "k", organizationId: "o", scopes: ["read"], rateLimit });
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("validation_error");
      expect(body.error.issues[0].path).toEqual(["limit"]);
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("7");
    }
    expect(parseWith(schema, { limit: "3" }, "x")).toEqual({ limit: 3 });
  });

  it("maps not-found and conflict errors to their status and code", async () => {
    const missing = apiError(notFound("Event"), rateLimit);
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: { code: "not_found", message: "Event not found." } });
    const busy = apiError(conflict("Order is free; nothing to refund."), rateLimit);
    expect(busy.status).toBe(409);
    await expect(busy.json()).resolves.toEqual({ error: { code: "conflict", message: "Order is free; nothing to refund." } });
  });

  it("validates the Idempotency-Key header", () => {
    expect(idempotencyKey(new Request("https://x.test/"))).toBeNull();
    expect(idempotencyKey(new Request("https://x.test/", { headers: { "idempotency-key": " abc " } }))).toBe("abc");
    expect(() => idempotencyKey(new Request("https://x.test/", { headers: { "idempotency-key": "  " } }))).toThrow(ApiRouteError);
    expect(() => idempotencyKey(new Request("https://x.test/", { headers: { "idempotency-key": "x".repeat(121) } }))).toThrow(/1 to 120/);
  });

  it("maps a service's plain Error to the chosen status and leaves driver errors alone", async () => {
    await expect(businessRule(409, async () => { throw new Error("This ticket type has sales."); })).rejects.toMatchObject({ status: 409, code: "conflict", message: "This ticket type has sales." });
    await expect(businessRule(422, async () => { throw new Error("Duplicate field keys: a"); })).rejects.toMatchObject({ status: 422, code: "validation_error", issues: [{ path: [], message: "Duplicate field keys: a" }] });
    const driver = Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" });
    await expect(businessRule(409, async () => { throw driver; })).rejects.toBe(driver);
    class Custom extends Error {}
    const custom = new Custom("nope");
    await expect(businessRule(409, async () => { throw custom; })).rejects.toBe(custom);
    await expect(businessRule(409, async () => 42)).resolves.toBe(42);
  });
});
