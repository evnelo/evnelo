import { createHash } from "node:crypto";
import { and, eq, isNull, lt, lte, sql } from "drizzle-orm";
import { apiIdempotencyKeys, apiKeys, apiRateLimits, type Database } from "@ot/db";
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
    .where(and(eq(apiKeys.hash, hashApiKey(secret)), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!key) throw new ApiAuthError(401, "unauthorized", "A valid Bearer API key is required.");
  if (!hasApiScope(key.scopes, requiredScope)) throw new ApiAuthError(403, "forbidden", `This API key requires the ${requiredScope} scope.`);

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
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
  await db.delete(apiIdempotencyKeys).where(lte(apiIdempotencyKeys.expiresAt, now));
  try {
    await db.insert(apiIdempotencyKeys).values({ id, apiKeyId, key, requestHash, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) });
    return { state: "started", id };
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY")) throw error;
  }
  const [existing] = await db.select().from(apiIdempotencyKeys).where(and(eq(apiIdempotencyKeys.apiKeyId, apiKeyId), eq(apiIdempotencyKeys.key, key))).limit(1);
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

export async function consumeApiRateLimit(db: Database, apiKeyId: string, limit = 120, now = new Date()) {
  const windowStart = new Date(now);
  windowStart.setUTCSeconds(0, 0);
  await db.delete(apiRateLimits).where(lt(apiRateLimits.windowStart, windowStart));
  await db.insert(apiRateLimits).values({ apiKeyId, windowStart, count: 1 }).onDuplicateKeyUpdate({ set: { count: sql`${apiRateLimits.count} + 1` } });
  const [row] = await db.select({ count: apiRateLimits.count }).from(apiRateLimits)
    .where(and(eq(apiRateLimits.apiKeyId, apiKeyId), eq(apiRateLimits.windowStart, windowStart))).limit(1);
  const resetAt = new Date(windowStart.getTime() + 60_000);
  const rateLimit = { limit, remaining: Math.max(0, limit - (row?.count ?? 1)), resetAt };
  if ((row?.count ?? 1) > limit) {
    const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
    throw new ApiRequestError(429, "rate_limit_exceeded", "API rate limit exceeded.", rateLimit, retryAfter);
  }
  return rateLimit;
}
