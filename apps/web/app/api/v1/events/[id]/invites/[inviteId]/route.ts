import { deleteEventInvite } from "@ot/core/services";
import { apiRoute, notFound, ok, requireOrgEvent } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export const DELETE = apiRoute<{ id: string; inviteId: string }>("write", async ({ auth, params }) => {
  await requireOrgEvent(auth, params.id);
  if (!(await deleteEventInvite(db, params.id, params.inviteId))) throw notFound("Invite");
  return ok(auth, { data: { id: params.inviteId, deleted: true } });
});
