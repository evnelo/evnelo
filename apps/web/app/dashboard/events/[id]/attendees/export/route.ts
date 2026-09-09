import { NextResponse } from "next/server";
import { attendeesCsv } from "@ot/core/services";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireEvent } from "@/lib/dashboard";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireEvent(id, "manage_attendees");
  const csv = await attendeesCsv(db, id, env.APP_URL);
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${event.slug}-attendees.csv"`, "cache-control": "private, no-store" },
  });
}
