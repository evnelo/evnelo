import { createHash } from "node:crypto";
import { consumeRateLimit } from "@ot/core/services";

/** Bucket id for non-API-key limits (uploads, geocoding, payment checks): hashed so identities never land in the table. */
export function sharedRateLimitBucket(scope: string, identity: string) {
  return `r${createHash("sha256").update(`${scope}:${identity}`).digest("hex").slice(0, 25)}`;
}

export function rateLimitWindowStart(now: Date, windowMs: number) {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export async function consumeSharedRateLimit(scope: string, identity: string, limit: number, windowMs: number, now = new Date()) {
  const { db } = await import("./db");
  return (await consumeRateLimit(db, sharedRateLimitBucket(scope, identity), limit, windowMs, now)).allowed;
}
