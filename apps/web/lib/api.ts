import { z } from "zod";
import type { Database, Event } from "@ot/db";
import { captureError } from "@/lib/observability";
import {
  ApiAuthError, ApiRequestError, type ApiKeyContext, type ApiRateLimit, type ApiScope,
  apiRequestHash, authenticateApiKey, consumeApiRateLimit, consumeRateLimit, executeIdempotentRequest, getEvent, parseBearerToken,
} from "@ot/core/services";
import { db } from "@/lib/db";
import { ApiHttpError, apiJson, authFailureBucket, readJsonBody } from "@/lib/api-http";

export type ApiRequestContext = ApiKeyContext & { rateLimit: ApiRateLimit };

const AUTH_FAILURES_PER_MINUTE = 20;
const MAX_IDEMPOTENCY_KEY_LENGTH = 120;

/**
 * Authenticate and consume the key's quota. Failed attempts are throttled separately (per
 * client when a trusted proxy header is configured, else per presented key prefix) so a
 * guessing loop hits 429 instead of a free lookup per try.
 */
export async function requireApiKey(request: Request, scope: ApiScope): Promise<ApiRequestContext> {
  const authorization = request.headers.get("authorization");
  try {
    const auth = await authenticateApiKey(db, authorization, scope);
    return { ...auth, rateLimit: await consumeApiRateLimit(db, auth.apiKeyId) };
  } catch (error) {
    if (error instanceof ApiAuthError) {
      const failures = await consumeRateLimit(db, authFailureBucket(request, parseBearerToken(authorization)), AUTH_FAILURES_PER_MINUTE, 60_000);
      if (!failures.allowed) {
        const retryAfter = Math.max(1, Math.ceil((failures.resetAt.getTime() - Date.now()) / 1000));
        throw new ApiRequestError(429, "rate_limit_exceeded", "Too many failed authentication attempts.", undefined, retryAfter);
      }
    }
    throw error;
  }
}

/** Errors a route raises on purpose after authentication: they carry the status and code the client sees. */
export class ApiRouteError extends Error {
  constructor(
    public readonly status: 404 | 409 | 422,
    public readonly code: "not_found" | "conflict" | "validation_error",
    message: string,
    public readonly issues?: unknown[],
  ) {
    super(message);
    this.name = "ApiRouteError";
  }
}

export const notFound = (what: string) => new ApiRouteError(404, "not_found", `${what} not found.`);
export const conflict = (message: string) => new ApiRouteError(409, "conflict", message);
export const invalid = (message: string, issues?: unknown[]) => new ApiRouteError(422, "validation_error", message, issues);

export function apiError(error: unknown, context?: ApiRequestContext | ApiRateLimit) {
  const consumedRateLimit = context && "rateLimit" in context ? context.rateLimit : context;
  if (error instanceof ApiAuthError) {
    return apiJson({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ApiHttpError) {
    return apiJson({ error: { code: error.code, message: error.message } }, { status: error.status }, consumedRateLimit);
  }
  if (error instanceof ApiRouteError) {
    return apiJson({ error: { code: error.code, message: error.message, ...(error.issues ? { issues: error.issues } : {}) } }, { status: error.status }, consumedRateLimit);
  }
  if (error instanceof ApiRequestError) {
    const headers = error.status === 429 ? { "Retry-After": String(error.retryAfter ?? 1) } : undefined;
    return apiJson({ error: { code: error.code, message: error.message } }, { status: error.status, headers }, error.rateLimit ?? consumedRateLimit);
  }
  captureError("api.unhandled", error);
  return apiJson({ error: { code: "internal_error", message: "An unexpected error occurred." } }, { status: 500 }, consumedRateLimit);
}

/* ---------- request parsing ---------- */

export function parseWith<S extends z.ZodTypeAny>(schema: S, value: unknown, message: string): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalid(message, parsed.error.issues);
  return parsed.data;
}

export function parseQuery<S extends z.ZodTypeAny>(request: Request, schema: S): z.output<S> {
  return parseWith(schema, Object.fromEntries(new URL(request.url).searchParams), "Invalid query parameters.");
}

export async function parseBody<S extends z.ZodTypeAny>(request: Request, schema: S, message = "Invalid request body."): Promise<z.output<S>> {
  return parseWith(schema, await readJsonBody(request), message);
}

/** `limit`/`offset` query parameters shared by every list endpoint. */
export const pageQuery = {
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
};

/**
 * Services signal business-rule violations with a plain `Error` (no driver `code`). Map those
 * to the status a client can act on; anything else (driver errors, bugs) stays a 500.
 */
export async function businessRule<T>(status: 409 | 422, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && error.constructor === Error && !("code" in error)) {
      throw status === 409 ? conflict(error.message) : invalid(error.message, [{ path: [], message: error.message }]);
    }
    throw error;
  }
}

/* ---------- route factory ---------- */

export type RouteContext<P> = { request: Request; auth: ApiRequestContext; params: P };

/**
 * Every organization endpoint: authenticate with the scope, resolve the dynamic segments, and turn
 * every thrown error into the documented JSON error. Handlers only deal with the happy path.
 */
export function apiRoute<P extends Record<string, string> = Record<string, never>>(scope: ApiScope, handler: (context: RouteContext<P>) => Promise<Response>) {
  return async (request: Request, context: { params: Promise<P> }): Promise<Response> => {
    let auth: ApiRequestContext | undefined;
    try {
      const [ctx, params] = await Promise.all([requireApiKey(request, scope), context.params]);
      auth = ctx;
      return await handler({ request, auth, params });
    } catch (error) {
      return apiError(error, auth);
    }
  };
}

/** The event, or a 404 when it does not exist or belongs to another organization (never a 403: ids must not leak). */
export async function requireOrgEvent(auth: ApiKeyContext, eventId: string, database: Database = db): Promise<Event> {
  const event = await getEvent(database, eventId);
  if (!event || event.organizationId !== auth.organizationId) throw notFound("Event");
  return event;
}

export function ok(auth: ApiRequestContext, body: unknown, status = 200) {
  return apiJson(body, { status }, auth.rateLimit);
}

/* ---------- writes ---------- */

export function idempotencyKey(request: Request): string | null {
  const header = request.headers.get("idempotency-key");
  if (header == null) return null;
  const key = header.trim();
  if (!key || key.length > MAX_IDEMPOTENCY_KEY_LENGTH) throw invalid(`Idempotency-Key must contain 1 to ${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`);
  return key;
}

export type MutationResult = { status?: number; body: unknown };

/**
 * Run a write. With an `Idempotency-Key` the operation executes inside the idempotency transaction
 * (claim, operate, store the response) and a repeat within 24 hours replays the stored response
 * with `Idempotency-Replayed: true`. Throw for failures so the claim rolls back and a retry re-executes.
 */
export async function mutate(request: Request, auth: ApiRequestContext, requestBody: unknown, operation: (database: Database) => Promise<MutationResult>): Promise<Response> {
  const key = idempotencyKey(request);
  if (!key) {
    const result = await operation(db);
    return apiJson(result.body, { status: result.status ?? 200 }, auth.rateLimit);
  }
  const hash = apiRequestHash(request.method, new URL(request.url).pathname, JSON.stringify(requestBody ?? null));
  const response = await executeIdempotentRequest(db, auth.apiKeyId, key, hash, async (tx) => {
    // a drizzle transaction exposes the same query surface as the pool-backed database
    const result = await operation(tx as unknown as Database);
    return { status: result.status ?? 200, body: result.body };
  });
  const headers = response.state === "replay" ? { "Idempotency-Replayed": "true" } : undefined;
  return apiJson(response.body, { status: response.status, headers }, auth.rateLimit);
}
