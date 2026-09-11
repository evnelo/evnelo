import { getAttendeeView } from "@evnelo/core/services";
import { apiRoute, notFound, ok, requireOrgEvent } from "@/lib/api";
import { serializeAttendee } from "@/lib/api-serializers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export const GET = apiRoute<{ id: string; attendeeId: string }>("read", async ({ auth, params }) => {
  await requireOrgEvent(auth, params.id);
  const view = await getAttendeeView(db, params.id, params.attendeeId);
  if (!view) throw notFound("Attendee");
  return ok(auth, { data: serializeAttendee(view) });
});
