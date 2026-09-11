import { z } from "zod";
import { listWaitlist, promoteWaitlistEntry } from "@evnelo/core/services";
import { apiRoute, conflict, mutate, notFound, parseBody, requireOrgEvent } from "@/lib/api";
import { serializeWaitlistEntry, waitlistOfferUrl } from "@/lib/api-serializers";

export const runtime = "nodejs";

const promoteInput = z.object({ ticketTypeId: z.string().length(26) });

const refusals = {
  already_offered: "This person already has an open offer.",
  registered: "This person already registered.",
  no_room: "No seat is free on that ticket type (or the event is at capacity). Free one first.",
} as const;

/**
 * Hold one seat on the ticket type for 24 hours and mint the claim link. Unlike the dashboard,
 * the API does not email the person: send them `offerUrl` yourself.
 */
export const POST = apiRoute<{ id: string; entryId: string }>("write", async ({ request, auth, params }) => {
  const { ticketTypeId } = await parseBody(request, promoteInput, "Invalid promotion.");
  await requireOrgEvent(auth, params.id);
  return mutate(request, auth, { ticketTypeId }, async (database) => {
    const result = await promoteWaitlistEntry(database, params.id, params.entryId, ticketTypeId);
    if (!result.ok) throw result.reason === "not_found" ? notFound("Waitlist entry") : conflict(refusals[result.reason]);
    const row = (await listWaitlist(database, params.id)).find((r) => r.entry.id === params.entryId) ?? { entry: result.entry, ticketTypeName: null };
    return { body: { data: { ...serializeWaitlistEntry(row), offerUrl: waitlistOfferUrl(result.entry.token!) } } };
  });
});
