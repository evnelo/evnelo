import { deleteWebhook, getWebhook, updateWebhook, webhookInput } from "@evnelo/core/services";
import { apiRoute, mutate, notFound, ok, parseBody } from "@/lib/api";
import { serializeWebhook } from "@/lib/api-serializers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Params = { id: string };

export const GET = apiRoute<Params>("read", async ({ auth, params }) => {
  const webhook = await getWebhook(db, auth.organizationId, params.id);
  if (!webhook) throw notFound("Webhook");
  return ok(auth, { data: serializeWebhook(webhook) });
});

/** Change the URL, the subscribed events, or pause/resume with `active`. */
export const PATCH = apiRoute<Params>("write", async ({ request, auth, params }) => {
  const patch = await parseBody(request, webhookInput.partial(), "Invalid webhook.");
  return mutate(request, auth, patch, async (database) => {
    const webhook = await updateWebhook(database, auth.organizationId, params.id, patch);
    if (!webhook) throw notFound("Webhook");
    return { body: { data: serializeWebhook(webhook) } };
  });
});

export const DELETE = apiRoute<Params>("write", async ({ auth, params }) => {
  if (!(await deleteWebhook(db, auth.organizationId, params.id))) throw notFound("Webhook");
  return ok(auth, { data: { id: params.id, deleted: true } });
});
