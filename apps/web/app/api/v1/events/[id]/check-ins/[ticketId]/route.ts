import { undoCheckIn } from "@ot/core/services";
import { apiRoute, notFound, ok, requireOrgEvent } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Undo the active check-in for a ticket; 404 when the ticket has none. */
export const DELETE = apiRoute<{ id: string; ticketId: string }>("write", async ({ auth, params }) => {
  await requireOrgEvent(auth, params.id);
  if (!(await undoCheckIn(db, params.id, params.ticketId))) throw notFound("Active check-in");
  return ok(auth, { data: { ticketId: params.ticketId, undone: true } });
});
