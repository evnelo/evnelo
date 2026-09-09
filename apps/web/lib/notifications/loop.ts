import { env } from "@/lib/env";
import { runJobs } from "./worker";

const TICK_MS = 10_000;
const g = globalThis as unknown as { __otJobLoop?: NodeJS.Timeout; __otJobRunning?: boolean };

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
      if (r.sent || r.failed || r.retried || r.skipped || r.requeued) console.log("[jobs]", JSON.stringify(r));
    } catch (e) {
      console.error("[jobs]", (e as Error).message);
    } finally {
      g.__otJobRunning = false;
    }
  };
  g.__otJobLoop = setInterval(tick, TICK_MS);
  g.__otJobLoop.unref?.();
  setTimeout(tick, 2_000).unref?.();
  console.log(`[jobs] in-process loop every ${TICK_MS / 1000}s`);
}
