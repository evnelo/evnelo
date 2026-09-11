import { z } from "zod";
import { getTicketType, listTicketTypes, paginateAll, ticketTypeInput, upsertTicketType } from "@evnelo/core/services";
import { apiRoute, mutate, ok, pageQuery, parseBody, parseQuery, requireOrgEvent } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Params = { id: string };

export const GET = apiRoute<Params>("read", async ({ request, auth, params }) => {
  const { limit, offset } = parseQuery(request, z.object(pageQuery));
  await requireOrgEvent(auth, params.id);
  return ok(auth, paginateAll(await listTicketTypes(db, params.id), limit, offset));
});

export const POST = apiRoute<Params>("write", async ({ request, auth, params }) => {
  const input = await parseBody(request, ticketTypeInput, "Invalid ticket type.");
  await requireOrgEvent(auth, params.id);
  return mutate(request, auth, input, async (database) => {
    const id = await upsertTicketType(database, params.id, input);
    return { status: 201, body: { data: await getTicketType(database, params.id, id) } };
  });
});
