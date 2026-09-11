import { z } from "zod";
import { createWebhook, listWebhooks, paginateAll, webhookInput } from "@evnelo/core/services";
import { apiRoute, mutate, ok, pageQuery, parseBody, parseQuery } from "@/lib/api";
import { serializeWebhook } from "@/lib/api-serializers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export const GET = apiRoute("read", async ({ request, auth }) => {
  const { limit, offset } = parseQuery(request, z.object(pageQuery));
  return ok(auth, paginateAll((await listWebhooks(db, auth.organizationId)).map(serializeWebhook), limit, offset));
});

/** Subscribe an https endpoint to events. The signing `secret` is returned once, here only. */
export const POST = apiRoute("write", async ({ request, auth }) => {
  const input = await parseBody(request, webhookInput, "Invalid webhook.");
  return mutate(request, auth, input, async (database) => {
    const webhook = await createWebhook(database, auth.organizationId, input);
    return { status: 201, body: { data: { ...serializeWebhook(webhook), secret: webhook.secret } } };
  });
});
