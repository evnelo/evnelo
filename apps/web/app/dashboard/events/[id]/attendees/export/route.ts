import { NextResponse } from "next/server";
import { attendeesCsv } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireEvent } from "@/lib/dashboard";
import { EVENTS } from "@/lib/analytics-events";
import { track } from "@/lib/posthog-server";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event, user, org } = await requireEvent(id, "manage_attendees");
  const csv = await attendeesCsv(db, id, env.APP_URL);
  track(EVENTS.exportDownloaded, { distinctId: user.id, organizationId: org.id, properties: { kind: "attendees_csv", eventId: id } });
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${event.slug}-attendees.csv"`, "cache-control": "private, no-store" },
  });
}
