import { NextResponse } from "next/server";
import { getEventByOrgAndSlug } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { calendarResponse } from "@/lib/calendar";

export const runtime = "nodejs";

/** GET /api/calendar/{orgSlug}/{eventSlug}.ics for public and unlisted events. */
export async function GET(_req: Request, { params }: { params: Promise<{ org: string; file: string }> }) {
  const { org, file } = await params;
  if (!file.endsWith(".ics")) return new NextResponse("not found", { status: 404 });
  const row = await getEventByOrgAndSlug(db, org, file.slice(0, -4));
  return calendarResponse(row);
}
