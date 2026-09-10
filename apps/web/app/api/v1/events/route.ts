import { z } from "zod";
import { apiRequestHash, createEvent, eventInput, executeIdempotentRequest, listOrgEvents } from "@ot/core/services";
import { apiError, requireApiKey, type ApiRequestContext } from "@/lib/api";
import { apiJson, readJsonBody } from "@/lib/api-http";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const queryInput = z.object({
  status: z.enum(["draft", "published", "cancelled", "ended"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request) {
  let auth: ApiRequestContext | undefined;
  try {
    auth = await requireApiKey(request, "read");
    const parsed = queryInput.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return apiJson({ error: { code: "validation_error", message: "Invalid query parameters.", issues: parsed.error.issues } }, { status: 422 }, auth.rateLimit);
    }
    const { limit, offset } = parsed.data;
    const data = await listOrgEvents(db, auth.organizationId, { status: parsed.data.status, limit: limit + 1, offset });
    const page = data.slice(0, limit);
    return apiJson({ data: page, pagination: { limit, offset, nextOffset: data.length > limit ? offset + limit : null } }, {}, auth.rateLimit);
  } catch (error) {
    return apiError(error, auth);
  }
}

export async function POST(request: Request) {
  let auth: ApiRequestContext | undefined;
  try {
    const context = await requireApiKey(request, "write");
    auth = context;
    const parsed = eventInput.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return apiJson({ error: { code: "validation_error", message: "Invalid event.", issues: parsed.error.issues } }, { status: 422 }, context.rateLimit);
    }
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? null;
    if (idempotencyKey != null && (!idempotencyKey || idempotencyKey.length > 120)) {
      return apiJson({ error: { code: "validation_error", message: "Idempotency-Key must contain 1 to 120 characters." } }, { status: 422 }, context.rateLimit);
    }
    if (idempotencyKey) {
      const response = await executeIdempotentRequest(
        db,
        context.apiKeyId,
        idempotencyKey,
        apiRequestHash(request.method, new URL(request.url).pathname, JSON.stringify(parsed.data)),
        async (tx) => ({ status: 201, body: { data: await createEvent(tx, context.organizationId, parsed.data) } }),
      );
      const headers = response.state === "replay" ? { "Idempotency-Replayed": "true" } : undefined;
      return apiJson(response.body, { status: response.status, headers }, context.rateLimit);
    }
    const body = { data: await createEvent(db, context.organizationId, parsed.data) };
    return apiJson(body, { status: 201 }, context.rateLimit);
  } catch (error) {
    return apiError(error, auth);
  }
}