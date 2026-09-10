import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { apiRateLimits } from "@ot/db";

export function sharedRateLimitBucket(scope: string, identity: string) {
  return `r${createHash("sha256").update(`${scope}:${identity}`).digest("hex").slice(0, 25)}`;
}

export function rateLimitWindowStart(now: Date, windowMs: number) {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export async function consumeSharedRateLimit(scope: string, identity: string, limit: number, windowMs: number, now = new Date()) {
  const { db } = await import("./db");
  const apiKeyId = sharedRateLimitBucket(scope, identity);
  const windowStart = rateLimitWindowStart(now, windowMs);
  const count = await db.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO api_rate_limits (api_key_id, window_start, count)
      VALUES (${apiKeyId}, ${windowStart}, LAST_INSERT_ID(1))
      ON DUPLICATE KEY UPDATE count = LAST_INSERT_ID(count + 1)
    `);
    const [rows] = await tx.execute(sql`SELECT LAST_INSERT_ID() AS count`);
    return Number(((rows as unknown) as Array<{ count: number | string }>)[0]?.count ?? 0);
  });
  await db.delete(apiRateLimits).where(lt(apiRateLimits.windowStart, new Date(now.getTime() - 24 * 60 * 60_000)));
  return count > 0 && count <= limit;
}
