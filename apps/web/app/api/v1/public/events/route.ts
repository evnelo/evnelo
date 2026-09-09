import { z } from "zod";
import { consumeApiRateLimit, listPublicEvents, type ApiRateLimit } from "@ot/core/services";
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
});

export async function GET(request: Request) {
  let rateLimit: ApiRateLimit | undefined;
  try {
    await consumeApiRateLimit(db, PUBLIC_API_GLOBAL_BUCKET, PUBLIC_API_GLOBAL_RATE_LIMIT);
    rateLimit = await consumeApiRateLimit(db, publicRateLimitBucket(request), PUBLIC_API_RATE_LIMIT);
    const parsed = queryInput.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return apiJson({ error: { code: "validation_error", message: "Invalid query parameters.", issues: parsed.error.issues } }, { status: 422 }, rateLimit);
    }
    return apiJson({ data: await listPublicEvents(db, parsed.data) }, {}, rateLimit);
  } catch (error) {
    return apiError(error, rateLimit);
  }
}