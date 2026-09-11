import { z } from "zod";
import { checkInTicket, listCheckInsPage, paginate } from "@evnelo/core/services";
import { apiRoute, mutate, ok, pageQuery, parseBody, parseQuery, requireOrgEvent } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Params = { id: string };

const checkInInput = z.object({
  ticketId: z.string().length(26).optional(),
  token: z.string().trim().min(1).max(2048).optional(),
}).refine((v) => v.ticketId || v.token, { message: "ticketId or token is required.", path: ["ticketId"] });

/** Active check-ins, newest first. */
export const GET = apiRoute<Params>("read", async ({ request, auth, params }) => {
  const { limit, offset } = parseQuery(request, z.object(pageQuery));
  await requireOrgEvent(auth, params.id);
  return ok(auth, paginate(await listCheckInsPage(db, params.id, { limit: limit + 1, offset }), limit, offset));
});

/**
 * Check a ticket in by id or QR token (a raw token or the ticket URL). Never fails for a bad
 * ticket: `outcome` says what happened (ok, already, not_found, revoked, not_confirmed, wrong_event).
 */
export const POST = apiRoute<Params>("write", async ({ request, auth, params }) => {
  const input = await parseBody(request, checkInInput, "Invalid check-in.");
  await requireOrgEvent(auth, params.id);
  return mutate(request, auth, input, async (database) => ({ body: { data: await checkInTicket(database, params.id, input, { userId: null, method: "manual" }) } }));
});
