import { z } from "zod";
import { eventInput, eventInputFromRecord, getEventWithRelations, listRegistrationFields, updateEvent } from "@evnelo/core/services";
import { apiRoute, mutate, notFound, ok, parseBody, parseWith, requireOrgEvent } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Params = { id: string };

export const GET = apiRoute<Params>("read", async ({ auth, params }) => {
  await requireOrgEvent(auth, params.id);
  const result = await getEventWithRelations(db, params.id);
  if (!result) throw notFound("Event");
  return ok(auth, { data: { ...result, registrationFields: await listRegistrationFields(db, params.id) } });
});

/**
 * Partial update. The patch is merged over the stored event (tags, hosts and sponsors included) and
 * validated as a whole, because the update service replaces every field and relation. Schedule or
 * venue changes on a published event queue the "event updated" notifications, as in the dashboard.
 */
export const PATCH = apiRoute<Params>("write", async ({ request, auth, params }) => {
  const patch = await parseBody(request, z.record(z.unknown()));
  await requireOrgEvent(auth, params.id);
  const current = await getEventWithRelations(db, params.id);
  if (!current) throw notFound("Event");
  const input = parseWith(eventInput, { ...eventInputFromRecord(current), ...patch }, "Invalid event.");
  return mutate(request, auth, patch, async (database) => ({ body: { data: (await updateEvent(database, params.id, input)).event } }));
});
