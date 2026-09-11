import { z } from "zod";
import { deleteTicketType, getTicketType, ticketTypeInput, ticketTypeInputFromRecord, upsertTicketType } from "@evnelo/core/services";
import { apiRoute, businessRule, mutate, notFound, parseBody, parseWith, requireOrgEvent } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Params = { id: string; ticketTypeId: string };

/** Partial update, merged over the stored ticket type. Quantity can't drop below seats already sold or held (422). */
export const PATCH = apiRoute<Params>("write", async ({ request, auth, params }) => {
  const patch = await parseBody(request, z.record(z.unknown()));
  await requireOrgEvent(auth, params.id);
  const current = await getTicketType(db, params.id, params.ticketTypeId);
  if (!current) throw notFound("Ticket type");
  const input = parseWith(ticketTypeInput, { ...ticketTypeInputFromRecord(current), ...patch }, "Invalid ticket type.");
  return mutate(request, auth, patch, async (database) => {
    await businessRule(422, () => upsertTicketType(database, params.id, input, params.ticketTypeId));
    return { body: { data: await getTicketType(database, params.id, params.ticketTypeId) } };
  });
});

/** A ticket type with sales or holds can't be deleted (409): hide it instead. */
export const DELETE = apiRoute<Params>("write", async ({ auth, params }) => {
  await requireOrgEvent(auth, params.id);
  if (!(await getTicketType(db, params.id, params.ticketTypeId))) throw notFound("Ticket type");
  await businessRule(409, () => deleteTicketType(db, params.id, params.ticketTypeId));
  return Response.json({ data: { id: params.ticketTypeId, deleted: true } }, { headers: { "Cache-Control": "private, no-store" } });
});
