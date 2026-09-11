import { removeWaitlistEntry } from "@evnelo/core/services";
import { apiRoute, notFound, ok, requireOrgEvent } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Remove an entry; an open offer gives its held seat back. */
export const DELETE = apiRoute<{ id: string; entryId: string }>("write", async ({ auth, params }) => {
  await requireOrgEvent(auth, params.id);
  if (!(await removeWaitlistEntry(db, params.id, params.entryId))) throw notFound("Waitlist entry");
  return ok(auth, { data: { id: params.entryId, deleted: true } });
});
