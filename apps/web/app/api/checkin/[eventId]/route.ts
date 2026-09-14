import { NextResponse } from "next/server";
import { z } from "zod";
import { checkInStats, checkInTicket, recentCheckIns, undoCheckIn } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { readJsonBody, sameOriginRequest } from "@/lib/api-http";
import { checkInAccess } from "@/lib/checkin-access";
import { EVENTS } from "@/lib/analytics-events";
import { track } from "@/lib/posthog-server";

export const runtime = "nodejs";

const checkInInput = z.object({
  token: z.string().trim().min(1).max(2048).optional(),
  ticketId: z.string().length(26).optional(),
  method: z.enum(["scan", "manual"]).default("scan"),
}).refine((v) => v.token || v.ticketId, { message: "token or ticketId required" });
const undoInput = z.object({ ticketId: z.string().length(26) });

type Params = { params: Promise<{ eventId: string }> };

/** POST /api/checkin/{eventId} → check a ticket in by QR token or ticket id. */
export async function POST(request: Request, { params }: Params) {
  const { eventId } = await params;
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const access = await checkInAccess(eventId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = checkInInput.safeParse(await readJsonBody(request, 4_096).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Scan a ticket QR code or pick an attendee." }, { status: 400 });
  const result = await checkInTicket(db, eventId, parsed.data, { userId: access.user.id, method: parsed.data.method });
  track(EVENTS.checkinScanned, { distinctId: access.user.id, organizationId: access.org.id, properties: { eventId, method: parsed.data.method, outcome: result.outcome } });
  const [stats, recent] = await Promise.all([checkInStats(db, eventId), recentCheckIns(db, eventId)]);
  return NextResponse.json({ ...result, stats, recent }, { headers: { "Cache-Control": "no-store" } });
}

/** DELETE /api/checkin/{eventId} → undo the active check-in for a ticket. */
export async function DELETE(request: Request, { params }: Params) {
  const { eventId } = await params;
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const access = await checkInAccess(eventId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = undoInput.safeParse(await readJsonBody(request, 1_024).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Which ticket?" }, { status: 400 });
  const undone = await undoCheckIn(db, eventId, parsed.data.ticketId);
  const [stats, recent] = await Promise.all([checkInStats(db, eventId), recentCheckIns(db, eventId)]);
  return NextResponse.json({ undone, stats, recent }, { headers: { "Cache-Control": "no-store" } });
}
