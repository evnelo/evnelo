import { getOrderDetails } from "@ot/core/services";
import { apiRoute, notFound, ok, requireOrgEvent } from "@/lib/api";
import { serializeAttendee } from "@/lib/api-serializers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export const GET = apiRoute<{ id: string; orderId: string }>("read", async ({ auth, params }) => {
  await requireOrgEvent(auth, params.id);
  const details = await getOrderDetails(db, params.id, params.orderId);
  if (!details) throw notFound("Order");
  return ok(auth, { data: { ...details.order, items: details.items, attendees: details.attendees.map(serializeAttendee) } });
});
