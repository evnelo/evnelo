import { getEventStats } from "@ot/core/services";
import { apiRoute, ok, requireOrgEvent } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Registrations, pending approvals, net revenue (minor units), check-ins, per ticket type and per day. */
export const GET = apiRoute<{ id: string }>("read", async ({ auth, params }) => {
  await requireOrgEvent(auth, params.id);
  return ok(auth, { data: await getEventStats(db, params.id) });
});
