import { z } from "zod";
import { ApiRequestError, consumeApiRateLimit, consumeRateLimit, listPublicEvents, type ApiRateLimit } from "@ot/core/services";
import { apiError } from "@/lib/api";
import {
  PUBLIC_API_GLOBAL_BUCKET,
  PUBLIC_API_GLOBAL_RATE_LIMIT,
  PUBLIC_API_RATE_LIMIT,
  apiJson,
  publicRateLimitBucket,
} from "@/lib/api-http";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const queryInput = z.object({
  query: z.string().trim().max(160).optional(),
  city: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(48),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request) {
  let rateLimit: ApiRateLimit | undefined;
  try {
    // per-client first (when clients can be told apart), so one abusive client can't drain the global ceiling
    const clientBucket = publicRateLimitBucket(request);
    if (clientBucket) rateLimit = await consumeApiRateLimit(db, clientBucket, PUBLIC_API_RATE_LIMIT);
    const global = await consumeRateLimit(db, PUBLIC_API_GLOBAL_BUCKET, PUBLIC_API_GLOBAL_RATE_LIMIT, 60_000);
    if (!global.allowed) {
      const retryAfter = Math.max(1, Math.ceil((global.resetAt.getTime() - Date.now()) / 1000));
      throw new ApiRequestError(429, "rate_limit_exceeded", "The public API is busy. Try again shortly.", undefined, retryAfter); // no global figures leaked
    }
    const parsed = queryInput.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return apiJson({ error: { code: "validation_error", message: "Invalid query parameters.", issues: parsed.error.issues } }, { status: 422 }, rateLimit);
    }
    const { limit, offset } = parsed.data;
    const data = await listPublicEvents(db, { ...parsed.data, limit: limit + 1 });
    return apiJson({ data: data.slice(0, limit), pagination: { limit, offset, nextOffset: data.length > limit ? offset + limit : null } }, {}, rateLimit);
  } catch (error) {
    return apiError(error, rateLimit);
  }
}