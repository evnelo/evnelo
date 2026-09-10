import { describe, expect, it } from "vitest";
import { createDb } from "@ot/db";
import { consumeRateLimit } from "../services/api";

/**
 * Runs against the local MySQL (docker compose up db) when reachable; skipped otherwise.
 * The point is the property mocks cannot prove: N concurrent consumers admit exactly `limit`.
 */
const url = process.env.DATABASE_URL ?? "mysql://openticket:openticket@localhost:3306/openticket";
const db = createDb(url);
const reachable = await db.execute("select 1").then(() => true, () => false);

describe.skipIf(!reachable)("consumeRateLimit against MySQL", () => {
  it("admits exactly `limit` of many concurrent calls in one window", async () => {
    const bucket = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 26);
    const now = new Date();
    const results = await Promise.all(Array.from({ length: 40 }, () => consumeRateLimit(db, bucket, 25, 60_000, now)));
    expect(results.filter((r) => r.allowed)).toHaveLength(25);
    expect(results.every((r) => r.limit === 25)).toBe(true);
    expect(Math.min(...results.map((r) => r.remaining))).toBe(0);
  });
});
