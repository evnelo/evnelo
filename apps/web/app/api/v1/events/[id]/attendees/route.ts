import { z } from "zod";
import { ATTENDEE_STATUSES, listAttendeesPage, paginate } from "@evnelo/core/services";
import { apiRoute, ok, pageQuery, parseQuery, requireOrgEvent } from "@/lib/api";
import { serializeAttendee } from "@/lib/api-serializers";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const listQuery = z.object({ q: z.string().trim().max(160).optional(), status: z.enum(ATTENDEE_STATUSES).optional(), ...pageQuery });

export const GET = apiRoute<{ id: string }>("read", async ({ request, auth, params }) => {
  const { q, status, limit, offset } = parseQuery(request, listQuery);
  await requireOrgEvent(auth, params.id);
  const rows = await listAttendeesPage(db, params.id, { q, status, limit: limit + 1, offset });
  return ok(auth, paginate(rows.map(serializeAttendee), limit, offset));
});
