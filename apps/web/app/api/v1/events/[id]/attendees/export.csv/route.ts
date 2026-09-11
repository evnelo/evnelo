import { attendeesCsv } from "@evnelo/core/services";
import { apiRoute, requireOrgEvent } from "@/lib/api";
import { rateLimitHeaders } from "@/lib/api-http";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/** Every attendee (all statuses) with their answers, one row per person, as the dashboard export. */
export const GET = apiRoute<{ id: string }>("read", async ({ auth, params }) => {
  const event = await requireOrgEvent(auth, params.id);
  const csv = await attendeesCsv(db, event.id, env.APP_URL);
  const headers = new Headers(rateLimitHeaders(auth.rateLimit));
  headers.set("Content-Type", "text/csv; charset=utf-8");
  headers.set("Content-Disposition", `attachment; filename="${event.slug}-attendees.csv"`);
  headers.set("Cache-Control", "private, no-store");
  return new Response(csv, { status: 200, headers });
});
