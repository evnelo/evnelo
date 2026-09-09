import { ApiAuthError, ApiRequestError, type ApiKeyContext, type ApiRateLimit, type ApiScope, authenticateApiKey, consumeApiRateLimit } from "@ot/core/services";
import { db } from "@/lib/db";
import { ApiHttpError, apiJson } from "@/lib/api-http";

export type ApiRequestContext = ApiKeyContext & { rateLimit: { limit: number; remaining: number; resetAt: Date } };

export async function requireApiKey(request: Request, scope: ApiScope): Promise<ApiRequestContext> {
  const auth = await authenticateApiKey(db, request.headers.get("authorization"), scope);
  return { ...auth, rateLimit: await consumeApiRateLimit(db, auth.apiKeyId) };
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
    return apiJson(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers },
      error.rateLimit ?? consumedRateLimit,
    );
  }
  console.error("[api]", error);
  return apiJson(
    { error: { code: "internal_error", message: "An unexpected error occurred." } },
    { status: 500 },
    consumedRateLimit,
  );
}