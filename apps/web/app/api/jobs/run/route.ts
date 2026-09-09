import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { runJobs } from "@/lib/notifications/worker";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/jobs/run — one pass of the job runner, for cron-driven deployments
 * (set JOBS_INLINE=false there). Authorization: Bearer <AUTH_SECRET>.
 */
export async function POST(req: Request) {
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok = given.length === env.AUTH_SECRET.length && timingSafeEqual(Buffer.from(given), Buffer.from(env.AUTH_SECRET));
  if (!ok) return new NextResponse("unauthorized", { status: 401 });
  return NextResponse.json(await runJobs({ force: true })); // cron hits are sparse, always schedule
}
