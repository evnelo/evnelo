import { z } from "zod";
import { listWaitlist, paginateAll } from "@evnelo/core/services";
import { apiRoute, ok, pageQuery, parseQuery, requireOrgEvent } from "@/lib/api";
import { serializeWaitlistEntry } from "@/lib/api-serializers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Entries oldest first with their derived status (waiting, offered, registered, expired). */
export const GET = apiRoute<{ id: string }>("read", async ({ request, auth, params }) => {
  const { limit, offset } = parseQuery(request, z.object(pageQuery));
  await requireOrgEvent(auth, params.id);
  return ok(auth, paginateAll((await listWaitlist(db, params.id)).map(serializeWaitlistEntry), limit, offset));
});
