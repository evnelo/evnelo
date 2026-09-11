import { NextResponse } from "next/server";
import { exportAttendeeData } from "@ot/core/services";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/dashboard";

export const runtime = "nodejs";

/** Data-subject access request: everything stored about one attendee, as JSON. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; attendeeId: string }> }) {
  const { id, attendeeId } = await params;
  await requireEvent(id, "manage_attendees");
  const data = await exportAttendeeData(db, id, attendeeId);
  if (!data) return new NextResponse("not found", { status: 404 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="attendee-${attendeeId}.json"`, "cache-control": "private, no-store" },
  });
}
