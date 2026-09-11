import { cancelEvent } from "@ot/core/services";
import { apiRoute, mutate, requireOrgEvent } from "@/lib/api";

export const runtime = "nodejs";

/** Cancel the event: attendees are told by email (and SMS where opted in). Paid orders are refunded separately. Idempotent. */
export const POST = apiRoute<{ id: string }>("write", async ({ request, auth, params }) => {
  await requireOrgEvent(auth, params.id);
  return mutate(request, auth, null, async (database) => ({ body: { data: await cancelEvent(database, params.id) } }));
});
