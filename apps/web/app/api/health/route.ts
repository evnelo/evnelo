import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobLoopStatus } from "@/lib/notifications/loop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 2_000;
/** The in-process loop ticks every 10s; a tick older than this means it is wedged or the process is overloaded. */
const JOBS_STALE_MS = 2 * 60_000;

/**
 * GET /api/health → 200 when the database answers and the job loop (if inline) is ticking, else 503.
 * Unauthenticated and deliberately terse: enough for a load balancer, Docker HEALTHCHECK or uptime
 * monitor, nothing that describes the deployment.
 */
export async function GET() {
  const database = await Promise.race([
    db.execute(sql`select 1`).then(() => "ok" as const, () => "unreachable" as const),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), DB_TIMEOUT_MS).unref?.()),
  ]);
  const jobs = jobLoopStatus();
  const jobsState = !jobs.inline ? "external" : !jobs.running ? "stopped" : jobs.lastRunAt && Date.now() - jobs.lastRunAt.getTime() > JOBS_STALE_MS ? "stale" : "ok";
  const ok = database === "ok" && (jobsState === "ok" || jobsState === "external");
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", database, jobs: jobsState, uptimeSeconds: Math.round(process.uptime()) },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function HEAD() {
  const response = await GET();
  return new Response(null, { status: response.status, headers: response.headers });
}
