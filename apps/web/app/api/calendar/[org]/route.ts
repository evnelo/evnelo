import { NextResponse } from "next/server";
import { findEventForLegacySlug } from "@ot/core/services";
import { db } from "@/lib/db";
import { calendarResponse } from "@/lib/calendar";

export const runtime = "nodejs";

/** Legacy GET /api/calendar/{slug}.ics from before per-organization slugs; resolves like /e/{slug}. */
export async function GET(_req: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org: file } = await params; // one segment: "{slug}.ics"
  if (!file.endsWith(".ics")) return new NextResponse("not found", { status: 404 });
  return calendarResponse(await findEventForLegacySlug(db, file.slice(0, -4)));
}
