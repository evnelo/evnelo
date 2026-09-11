import { z } from "zod";
import { createEventInvite, eventInviteInput, listEventInvites, paginateAll } from "@ot/core/services";
import { apiRoute, mutate, ok, pageQuery, parseBody, parseQuery, requireOrgEvent } from "@/lib/api";
import { serializeInvite } from "@/lib/api-serializers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Params = { id: string };

export const GET = apiRoute<Params>("read", async ({ request, auth, params }) => {
  const { limit, offset } = parseQuery(request, z.object(pageQuery));
  await requireOrgEvent(auth, params.id);
  return ok(auth, paginateAll((await listEventInvites(db, params.id)).map(serializeInvite), limit, offset));
});

/** Mint an invite link (optionally bound to one email). The API does not send it: share `url` yourself. */
export const POST = apiRoute<Params>("write", async ({ request, auth, params }) => {
  const input = await parseBody(request, eventInviteInput, "Invalid invite.");
  await requireOrgEvent(auth, params.id);
  return mutate(request, auth, input, async (database) => ({ status: 201, body: { data: serializeInvite(await createEventInvite(database, params.id, input)) } }));
});
