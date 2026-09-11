import { z } from "zod";
import { createEvent, eventInput, listOrgEvents, paginate } from "@evnelo/core/services";
import { apiRoute, mutate, ok, pageQuery, parseBody, parseQuery } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const listQuery = z.object({ status: z.enum(["draft", "published", "cancelled", "ended"]).optional(), ...pageQuery });

export const GET = apiRoute("read", async ({ request, auth }) => {
  const { status, limit, offset } = parseQuery(request, listQuery);
  const rows = await listOrgEvents(db, auth.organizationId, { status, limit: limit + 1, offset });
  return ok(auth, paginate(rows, limit, offset));
});

export const POST = apiRoute("write", async ({ request, auth }) => {
  const input = await parseBody(request, eventInput, "Invalid event.");
  return mutate(request, auth, input, async (database) => ({ status: 201, body: { data: await createEvent(database, auth.organizationId, input) } }));
});
