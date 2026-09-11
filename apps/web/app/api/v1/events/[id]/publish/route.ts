import { publishEvent } from "@ot/core/services";
import { apiRoute, businessRule, mutate, requireOrgEvent } from "@/lib/api";

export const runtime = "nodejs";

/** Draft → published. Adds a free "General admission" ticket type when the event has none. Cancelled events can't be published (409). */
export const POST = apiRoute<{ id: string }>("write", async ({ request, auth, params }) => {
  await requireOrgEvent(auth, params.id);
  return mutate(request, auth, null, async (database) => ({ body: { data: await businessRule(409, () => publishEvent(database, params.id)) } }));
});
