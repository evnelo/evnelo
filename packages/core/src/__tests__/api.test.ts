import { describe, expect, it } from "vitest";
import type { Database } from "@ot/db";
import { authenticateApiKey, beginIdempotentRequest, consumeApiRateLimit, consumeRateLimit, executeIdempotentRequest, hashApiKey, hasApiScope, parseBearerToken } from "../services/api";

function fakeDb(row: { id: string; organizationId: string; scopes: string[] } | null) {
  let lastUsedAtUpdated = false;
  const db = {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => row ? [row] : [] }) }) }) }),
    update: () => ({ set: () => ({ where: async () => { lastUsedAtUpdated = true; } }) }),
  } as unknown as Database;
  return { db, wasUpdated: () => lastUsedAtUpdated };
}

describe("API key primitives", () => {
  it("parses a case-insensitive Bearer token and rejects malformed headers", () => {
    expect(parseBearerToken("Bearer ev_live_example")).toBe("ev_live_example");
    expect(parseBearerToken("bearer ev_live_example")).toBe("ev_live_example");
    expect(parseBearerToken("Basic abc")).toBeNull();
    expect(parseBearerToken("Bearer ")).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });

  it("hashes the complete API key with SHA-256", () => {
    expect(hashApiKey("ev_live_example")).toBe("baa423252b9a77cca4e2441ed9d22666603c52025904b8db86075a88d952ea01");
  });

  it("requires the requested scope", () => {
    expect(hasApiScope(["read"], "read")).toBe(true);
    expect(hasApiScope(["write"], "write")).toBe(true);
    expect(hasApiScope(["read"], "write")).toBe(false);
    expect(hasApiScope([], "read")).toBe(false);
  });

  it("rejects missing and unknown API keys without revealing which failed", async () => {
    const missing = fakeDb(null);
    await expect(authenticateApiKey(missing.db, null, "read")).rejects.toMatchObject({ status: 401, code: "unauthorized" });
    await expect(authenticateApiKey(missing.db, "Bearer ev_live_unknown", "read")).rejects.toMatchObject({ status: 401, code: "unauthorized" });
  });

  it("rejects a valid key without the required scope", async () => {
    const { db } = fakeDb({ id: "key-id", organizationId: "org-id", scopes: ["read"] });
    await expect(authenticateApiKey(db, "Bearer ev_live_readonly", "write")).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("returns the key context and records successful use", async () => {
    const fixture = fakeDb({ id: "key-id", organizationId: "org-id", scopes: ["read"] });
    await expect(authenticateApiKey(fixture.db, "Bearer ev_live_valid", "read")).resolves.toEqual({
      apiKeyId: "key-id", organizationId: "org-id", scopes: ["read"],
    });
    expect(fixture.wasUpdated()).toBe(true);
  });

  it("reuses an idempotency key whose 24h retention has lapsed", async () => {
    const calls: string[] = [];
    let inserts = 0;
    const now = new Date("2030-01-02T03:04:05.000Z");
    const db = {
      insert: () => ({ values: async () => { calls.push("insert"); if (++inserts === 1) throw Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" }); } }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: "old", requestHash: "other", responseStatus: 201, responseBody: {}, expiresAt: new Date("2030-01-01T00:00:00.000Z") }] }) }) }),
      delete: () => ({ where: async () => { calls.push("delete"); } }),
    } as unknown as Database;

    await expect(beginIdempotentRequest(db, "key-id", "request-id", "request-hash", now)).resolves.toMatchObject({ state: "started" });
    expect(calls).toEqual(["insert", "delete", "insert"]);
  });

  function rateLimitDb(counts: number[]) {
    const executed: string[] = [];
    // consumeRateLimit issues exactly two statements per call: the atomic upsert, then LAST_INSERT_ID()
    const tx = { execute: async () => {
      if (executed.length % 2 === 0) { executed.push("upsert"); return [[]]; }
      executed.push("read");
      return [[{ count: counts.shift() ?? 0 }]];
    } };
    const db = { transaction: async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx) } as unknown as Database;
    return { db, executed };
  }

  it("reports an exact reset time when the API rate limit is exceeded", async () => {
    const { db, executed } = rateLimitDb([121]);
    await expect(consumeApiRateLimit(db, "key-id", 120, new Date("2030-01-02T03:04:45.000Z"))).rejects.toMatchObject({
      status: 429,
      code: "rate_limit_exceeded",
      retryAfter: 15,
      rateLimit: { limit: 120, remaining: 0, resetAt: new Date("2030-01-02T03:05:00.000Z") },
    });
    expect(executed).toEqual(["upsert", "read"]);
  });

  it("returns the remaining quota from a single atomic upsert", async () => {
    const { db } = rateLimitDb([7]);
    await expect(consumeApiRateLimit(db, "key-id", 120, new Date("2030-01-02T03:04:45.000Z"))).resolves.toEqual({
      limit: 120, remaining: 113, resetAt: new Date("2030-01-02T03:05:00.000Z"),
    });
    const shared = await consumeRateLimit(rateLimitDb([3]).db, "bucket", 3, 60 * 60_000, new Date("2030-01-02T03:04:45.000Z"));
    expect(shared).toEqual({ limit: 3, remaining: 0, resetAt: new Date("2030-01-02T04:00:00.000Z"), allowed: true });
    expect((await consumeRateLimit(rateLimitDb([4]).db, "bucket", 3, 60 * 60_000)).allowed).toBe(false);
  });

  it("stores a successful idempotent response in the same transaction as the operation", async () => {
    const calls: string[] = [];
    const tx = {
      insert: () => ({ values: async () => { calls.push("claim"); } }),
      update: () => ({ set: () => ({ where: async () => { calls.push("complete"); } }) }),
    };
    const db = {
      transaction: async (operation: (transaction: typeof tx) => Promise<unknown>) => {
        calls.push("transaction");
        return operation(tx);
      },
    } as unknown as Database;

    await expect(executeIdempotentRequest(db, "key-id", "request-id", "request-hash", async () => {
      calls.push("operation");
      return { status: 201, body: { data: { id: "event-id" } } };
    })).resolves.toEqual({ state: "completed", status: 201, body: { data: { id: "event-id" } } });
    expect(calls).toEqual(["transaction", "claim", "operation", "complete"]);
  });
});
