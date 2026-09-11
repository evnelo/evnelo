import { captureError } from "@/lib/observability";
import { env } from "@/lib/env";
import { runJobs } from "./worker";

const TICK_MS = 10_000;
const g = globalThis as unknown as { __otJobLoop?: NodeJS.Timeout; __otJobRunning?: boolean; __otJobLastRunAt?: Date; __otJobLastError?: string };

/** For /api/health: whether the loop is on and when it last completed a tick. */
export function jobLoopStatus() {
  return { inline: env.JOBS_INLINE !== "false", running: Boolean(g.__otJobLoop), lastRunAt: g.__otJobLastRunAt ?? null, lastError: g.__otJobLastError ?? null };
}

/**
 * In-process job loop for self-hosters: started once per server process from
 * instrumentation.ts. Set JOBS_INLINE=false on platforms without a long-lived process
 * and hit POST /api/jobs/run from a cron instead.
 */
export function startJobLoop() {
  if (g.__otJobLoop || env.JOBS_INLINE === "false") return;
  const tick = async () => {
    if (g.__otJobRunning) return;
    g.__otJobRunning = true;
    try {
      const r = await runJobs();
      g.__otJobLastRunAt = new Date();
      g.__otJobLastError = undefined;
      if (r.sent || r.failed || r.retried || r.skipped || r.requeued || r.expiredHolds || r.reconciled) console.log("[jobs]", JSON.stringify(r));
    } catch (e) {
      g.__otJobLastError = (e as Error).message;
      captureError("jobs.loop", e);
    } finally {
      g.__otJobRunning = false;
    }
  };
  g.__otJobLoop = setInterval(tick, TICK_MS);
  g.__otJobLoop.unref?.();
  setTimeout(tick, 2_000).unref?.();
  console.log(`[jobs] in-process loop every ${TICK_MS / 1000}s`);
}
