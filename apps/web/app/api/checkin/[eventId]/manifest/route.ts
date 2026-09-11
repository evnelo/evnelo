import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { checkInStats, listCheckInAttendees, recentCheckIns } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { checkInAccess } from "@/lib/checkin-access";

export const runtime = "nodejs";

/**
 * GET /api/checkin/{eventId}/manifest → every confirmed ticket holder with a SHA-256 of the ticket
 * token. The scanner keeps this in memory: it powers the manual search and lets a phone that loses
 * signal keep validating scans (it hashes what it reads and looks the hash up), queueing the
 * check-ins to replay when it is back online. Tokens themselves never leave the server.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const access = await checkInAccess(eventId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const [rows, stats, recent] = await Promise.all([listCheckInAttendees(db, eventId), checkInStats(db, eventId), recentCheckIns(db, eventId)]);
  const tickets = rows.map((r) => ({
    id: r.ticketId, h: createHash("sha256").update(r.token).digest("hex"), n: r.name, e: r.email, t: r.ticketTypeName, g: r.hostName, c: r.checkedInAt?.toISOString() ?? null,
  }));
  return NextResponse.json({ generatedAt: new Date().toISOString(), event: { id: access.event.id, name: access.event.name }, stats, recent, tickets }, { headers: { "Cache-Control": "private, no-store" } });
}
