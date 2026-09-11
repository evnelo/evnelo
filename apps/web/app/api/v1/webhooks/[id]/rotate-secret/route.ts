import { rotateWebhookSecret } from "@ot/core/services";
import { apiRoute, mutate, notFound } from "@/lib/api";

export const runtime = "nodejs";

/** Replace the signing secret. The old one stops verifying immediately; the new one is returned once. */
export const POST = apiRoute<{ id: string }>("write", async ({ request, auth, params }) => {
  return mutate(request, auth, null, async (database) => {
    const secret = await rotateWebhookSecret(database, auth.organizationId, params.id);
    if (!secret) throw notFound("Webhook");
    return { body: { data: { id: params.id, secret } } };
  });
});
