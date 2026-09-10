import { ApiAuthError, ApiRequestError, type ApiKeyContext, type ApiRateLimit, type ApiScope, authenticateApiKey, consumeApiRateLimit, consumeRateLimit, parseBearerToken } from "@ot/core/services";
import { db } from "@/lib/db";
import { ApiHttpError, apiJson, authFailureBucket } from "@/lib/api-http";

export type ApiRequestContext = ApiKeyContext & { rateLimit: ApiRateLimit };

const AUTH_FAILURES_PER_MINUTE = 20;

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

export function apiError(error: unknown, context?: ApiRequestContext | ApiRateLimit) {
  const consumedRateLimit = context && "rateLimit" in context ? context.rateLimit : context;
  if (error instanceof ApiAuthError) {
    return apiJson({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ApiHttpError) {
    return apiJson({ error: { code: error.code, message: error.message } }, { status: error.status }, consumedRateLimit);
  }
  if (error instanceof ApiRequestError) {
    const headers = error.status === 429 ? { "Retry-After": String(error.retryAfter ?? 1) } : undefined;
    return apiJson({ error: { code: error.code, message: error.message } }, { status: error.status, headers }, error.rateLimit ?? consumedRateLimit);
  }
  console.error("[api]", error);
  return apiJson({ error: { code: "internal_error", message: "An unexpected error occurred." } }, { status: 500 }, consumedRateLimit);
}
