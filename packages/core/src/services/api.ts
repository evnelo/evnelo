import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, lt, lte, or, sql } from "drizzle-orm";
import { apiIdempotencyKeys, apiKeys, apiRateLimits, organizations, type Database } from "@evnelo/db";
import { newId } from "../ids";
import type { DbOrTx } from "./db";

export type ApiScope = "read" | "write";

export function parseBearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function hasApiScope(scopes: readonly string[], required: ApiScope): boolean {
  return scopes.includes(required);
}

export class ApiAuthError extends Error {
  constructor(public readonly status: 401 | 403, public readonly code: "unauthorized" | "forbidden", message: string) {
    super(message);
    this.name = "ApiAuthError";
  }
}

export type ApiKeyContext = { apiKeyId: string; organizationId: string; scopes: string[] };

export type ApiRateLimit = { limit: number; remaining: number; resetAt: Date };

export class ApiRequestError extends Error {
  constructor(
    public readonly status: 409 | 429,
    public readonly code: "idempotency_conflict" | "idempotency_in_progress" | "rate_limit_exceeded",
    message: string,
    public readonly rateLimit?: ApiRateLimit,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function authenticateApiKey(db: Database, authorization: string | null, requiredScope: ApiScope): Promise<ApiKeyContext> {
  const secret = parseBearerToken(authorization);
  if (!secret) throw new ApiAuthError(401, "unauthorized", "A valid Bearer API key is required.");

  const [key] = await db
    .select({ id: apiKeys.id, organizationId: apiKeys.organizationId, scopes: apiKeys.scopes })
    .from(apiKeys)
    .innerJoin(organizations, eq(apiKeys.organizationId, organizations.id))
    .where(and(eq(apiKeys.hash, hashApiKey(secret)), isNull(apiKeys.revokedAt), isNull(organizations.deletedAt)))
    .limit(1);
  if (!key) throw new ApiAuthError(401, "unauthorized", "A valid Bearer API key is required.");
  if (!hasApiScope(key.scopes, requiredScope)) throw new ApiAuthError(403, "forbidden", `This API key requires the ${requiredScope} scope.`);

  await db.update(apiKeys).set({ lastUsedAt: new Date() })
    .where(and(eq(apiKeys.id, key.id), or(isNull(apiKeys.lastUsedAt), lt(apiKeys.lastUsedAt, new Date(Date.now() - 60_000)))));
  return { apiKeyId: key.id, organizationId: key.organizationId, scopes: key.scopes };
}

export function apiRequestHash(method: string, pathname: string, body: string): string {
  return hashApiKey(`${method.toUpperCase()}\n${pathname}\n${body}`);
}

export type IdempotencyResult =
  | { state: "started"; id: string }
  | { state: "replay"; status: number; body: unknown };

export async function beginIdempotentRequest(db: DbOrTx, apiKeyId: string, key: string, requestHash: string, now = new Date()): Promise<IdempotencyResult> {
  const id = newId();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const claim = async () => {
    try {
      await db.insert(apiIdempotencyKeys).values({ id, apiKeyId, key, requestHash, expiresAt });
      return true;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") return false;
      throw error;
    }
  };
  if (await claim()) return { state: "started", id };
  const [existing] = await db.select().from(apiIdempotencyKeys).where(and(eq(apiIdempotencyKeys.apiKeyId, apiKeyId), eq(apiIdempotencyKeys.key, key))).limit(1);
  if (existing && existing.expiresAt <= now) {
    // a key past its 24h retention may be reused; the periodic purge normally removes these first
    await db.delete(apiIdempotencyKeys).where(eq(apiIdempotencyKeys.id, existing.id));
    if (await claim()) return { state: "started", id };
    throw new ApiRequestError(409, "idempotency_in_progress", "A request with that idempotency key is still in progress.");
  }
  if (!existing || existing.requestHash !== requestHash) {
    throw new ApiRequestError(409, "idempotency_conflict", "That idempotency key was already used for a different request.");
  }
  if (existing.responseStatus == null) {
    throw new ApiRequestError(409, "idempotency_in_progress", "A request with that idempotency key is still in progress.");
  }
  return { state: "replay", status: existing.responseStatus, body: existing.responseBody };
}

export async function completeIdempotentRequest(db: DbOrTx, id: string, status: number, body: unknown) {
  await db.update(apiIdempotencyKeys).set({ responseStatus: status, responseBody: body }).where(eq(apiIdempotencyKeys.id, id));
}

export type IdempotentExecutionResult =
  | { state: "completed"; status: number; body: unknown }
  | { state: "replay"; status: number; body: unknown };

export async function executeIdempotentRequest(
  db: Database,
  apiKeyId: string,
  key: string,
  requestHash: string,
  operation: (tx: DbOrTx) => Promise<{ status: number; body: unknown }>,
): Promise<IdempotentExecutionResult> {
  return db.transaction(async (tx) => {
    const reservation = await beginIdempotentRequest(tx, apiKeyId, key, requestHash);
    if (reservation.state === "replay") return reservation;
    const response = await operation(tx);
    await completeIdempotentRequest(tx, reservation.id, response.status, response.body);
    return { state: "completed", ...response };
  });
}

/**
 * Fixed-window counter shared by API keys, public-API client buckets, uploads, geocoding and
 * payment-resume checks. One atomic upsert per call: the LAST_INSERT_ID trick returns the
 * post-increment count without a second locked read. `bucket` must fit char(26).
 */
export async function consumeRateLimit(db: Database, bucket: string, limit: number, windowMs: number, now = new Date()): Promise<ApiRateLimit & { allowed: boolean }> {
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const count = await db.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO api_rate_limits (api_key_id, window_start, count)
      VALUES (${bucket}, ${windowStart}, LAST_INSERT_ID(1))
      ON DUPLICATE KEY UPDATE count = LAST_INSERT_ID(count + 1)
    `);
    const [rows] = await tx.execute(sql`SELECT LAST_INSERT_ID() AS count`);
    return Number(((rows as unknown) as Array<{ count: number | string }>)[0]?.count ?? 0);
  });
  const resetAt = new Date(windowStart.getTime() + windowMs);
  return { limit, remaining: Math.max(0, limit - count), resetAt, allowed: count > 0 && count <= limit };
}

/** Per-API-key limit (one-minute window). Throws the 429 the route returns. */
export async function consumeApiRateLimit(db: Database, apiKeyId: string, limit = 120, now = new Date()): Promise<ApiRateLimit> {
  const { allowed, remaining, resetAt } = await consumeRateLimit(db, apiKeyId, limit, 60_000, now);
  if (!allowed) {
    const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
    throw new ApiRequestError(429, "rate_limit_exceeded", "API rate limit exceeded.", { limit, remaining: 0, resetAt }, retryAfter);
  }
  return { limit, remaining, resetAt };
}

/** Drop old rate-limit windows and expired idempotency keys. Runs from the job loop, never inside request transactions. */
export async function purgeApiHousekeeping(db: Database, now = new Date()) {
  const [limits] = await db.delete(apiRateLimits).where(lt(apiRateLimits.windowStart, new Date(now.getTime() - 24 * 60 * 60_000)));
  const [keys] = await db.delete(apiIdempotencyKeys).where(lte(apiIdempotencyKeys.expiresAt, now));
  return { rateLimitRows: limits.affectedRows, idempotencyKeys: keys.affectedRows };
}

/* ---------- key management ---------- */

export const API_KEY_PREFIX = "ev_live_";

/** Mint a key. The secret is returned exactly once; only its SHA-256 and a display prefix are stored. */
export async function createApiKey(db: Database, input: { organizationId: string; name: string; scopes: ApiScope[] }) {
  const secret = `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  const id = newId();
  await db.insert(apiKeys).values({ id, organizationId: input.organizationId, name: input.name.trim().slice(0, 80) || "API key", prefix: secret.slice(0, 12), hash: hashApiKey(secret), scopes: input.scopes });
  return { id, secret, prefix: secret.slice(0, 12) };
}

export async function listApiKeys(db: Database, organizationId: string) {
  return db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, scopes: apiKeys.scopes, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt })
    .from(apiKeys).where(eq(apiKeys.organizationId, organizationId)).orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(db: Database, organizationId: string, id: string) {
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, organizationId), isNull(apiKeys.revokedAt)));
}
