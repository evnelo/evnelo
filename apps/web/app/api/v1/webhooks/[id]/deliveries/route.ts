import { z } from "zod";
import { getWebhook, listWebhookDeliveries, paginate } from "@evnelo/core/services";
import { apiRoute, notFound, ok, pageQuery, parseQuery } from "@/lib/api";
import { serializeWebhookDelivery } from "@/lib/api-serializers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Recent deliveries, newest first, with the attempt count, last response status and derived state. */
export const GET = apiRoute<{ id: string }>("read", async ({ request, auth, params }) => {
  const { limit, offset } = parseQuery(request, z.object(pageQuery));
  if (!(await getWebhook(db, auth.organizationId, params.id))) throw notFound("Webhook");
  const rows = await listWebhookDeliveries(db, auth.organizationId, params.id, offset + limit + 1);
  return ok(auth, paginate(rows.slice(offset).map(serializeWebhookDelivery), limit, offset));
});
