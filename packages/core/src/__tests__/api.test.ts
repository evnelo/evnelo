import { describe, expect, it } from "vitest";
import type { Database } from "@ot/db";
import { authenticateApiKey, beginIdempotentRequest, consumeApiRateLimit, executeIdempotentRequest, hashApiKey, hasApiScope, parseBearerToken } from "../services/api";

function fakeDb(row: { id: string; organizationId: string; scopes: string[] } | null) {
  let lastUsedAtUpdated = false;
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => row ? [row] : [] }) }) }),
    update: () => ({ set: () => ({ where: async () => { lastUsedAtUpdated = true; } }) }),
  } as unknown as Database;
  return { db, wasUpdated: () => lastUsedAtUpdated };
}

describe("API key primitives", () => {
  it("parses a case-insensitive Bearer token and rejects malformed headers", () => {
    expect(parseBearerToken("Bearer ot_live_example")).toBe("ot_live_example");
    expect(parseBearerToken("bearer ot_live_example")).toBe("ot_live_example");
    expect(parseBearerToken("Basic abc")).toBeNull();
    expect(parseBearerToken("Bearer ")).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });

  it("hashes the complete API key with SHA-256", () => {
    expect(hashApiKey("ot_live_example")).toBe("42af7093f1e33afc128210b963fae1024fddde0c086a4fba4b1d4fe779dfeb9b");
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
    await expect(authenticateApiKey(missing.db, "Bearer ot_live_unknown", "read")).rejects.toMatchObject({ status: 401, code: "unauthorized" });
  });

  it("rejects a valid key without the required scope", async () => {
    const { db } = fakeDb({ id: "key-id", organizationId: "org-id", scopes: ["read"] });
    await expect(authenticateApiKey(db, "Bearer ot_live_readonly", "write")).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("returns the key context and records successful use", async () => {
    const fixture = fakeDb({ id: "key-id", organizationId: "org-id", scopes: ["read"] });
    await expect(authenticateApiKey(fixture.db, "Bearer ot_live_valid", "read")).resolves.toEqual({
      apiKeyId: "key-id", organizationId: "org-id", scopes: ["read"],
    });
    expect(fixture.wasUpdated()).toBe(true);
  });

  it("removes an expired idempotency reservation before claiming its key", async () => {
    const calls: string[] = [];
    let inserted: { expiresAt: Date } | undefined;
    const db = {
      delete: () => ({ where: async () => { calls.push("delete"); } }),
      insert: () => ({ values: async (value: { expiresAt: Date }) => { calls.push("insert"); inserted = value; } }),
    } as unknown as Database;
    const now = new Date("2030-01-02T03:04:05.000Z");

    await expect(beginIdempotentRequest(db, "key-id", "request-id", "request-hash", now)).resolves.toMatchObject({ state: "started" });
    expect(calls).toEqual(["delete", "insert"]);
    expect(inserted?.expiresAt.toISOString()).toBe("2030-01-03T03:04:05.000Z");
  });

  it("reports an exact reset time when the API rate limit is exceeded", async () => {
    const calls: string[] = [];
    const db = {
      delete: () => ({ where: async () => { calls.push("delete-stale"); } }),
      insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => { calls.push("increment"); } }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ count: 121 }] }) }) }),
    } as unknown as Database;

    await expect(consumeApiRateLimit(db, "key-id", 120, new Date("2030-01-02T03:04:45.000Z"))).rejects.toMatchObject({
      status: 429,
      code: "rate_limit_exceeded",
      retryAfter: 15,
      rateLimit: { limit: 120, remaining: 0, resetAt: new Date("2030-01-02T03:05:00.000Z") },
    });
    expect(calls).toEqual(["delete-stale", "increment"]);
  });

  it("stores a successful idempotent response in the same transaction as the operation", async () => {
    const calls: string[] = [];
    const tx = {
      delete: () => ({ where: async () => { calls.push("delete-expired"); } }),
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
    expect(calls).toEqual(["transaction", "delete-expired", "claim", "operation", "complete"]);
  });
});
