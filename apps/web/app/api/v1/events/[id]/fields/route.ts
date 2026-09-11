import { listRegistrationFields, registrationFieldsInput, saveRegistrationFields } from "@evnelo/core/services";
import { apiRoute, businessRule, mutate, ok, parseBody, requireOrgEvent } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Params = { id: string };

export const GET = apiRoute<Params>("read", async ({ auth, params }) => {
  await requireOrgEvent(auth, params.id);
  return ok(auth, { data: await listRegistrationFields(db, params.id) });
});

/**
 * Replace the whole form (order = position). Send each existing field's `id` to keep answers
 * attached; fields without an id are created and omitted ones are deleted. Same input as the dashboard builder.
 */
export const PUT = apiRoute<Params>("write", async ({ request, auth, params }) => {
  const fields = await parseBody(request, registrationFieldsInput, "Invalid registration fields.");
  await requireOrgEvent(auth, params.id);
  return mutate(request, auth, fields, async (database) => ({ body: { data: await businessRule(422, () => saveRegistrationFields(database, params.id, fields)) } }));
});
