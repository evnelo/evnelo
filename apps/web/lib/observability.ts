import { env } from "./env";
import { log } from "./log";
import { posthogServer } from "./posthog-server";

export const errorReportingConfigured = Boolean(env.POSTHOG_KEY);

/**
 * The one place unexpected failures go. Always logs (a structured line, greppable in container
 * output and searchable in PostHog Logs); forwards the exception to PostHog error tracking when
 * POSTHOG_KEY is set. `scope` is a stable dotted tag such as "jobs.expireHolds" so issues group by
 * code path. Keep PII out of `context`: ids, not emails.
 */
export function captureError(scope: string, error: unknown, context?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
  log.error(scope, err.message, { ...flatten(context), stack: err.stack });
  posthogServer()?.captureException(err, undefined, { scope, ...context });
}

function flatten(context?: Record<string, unknown>) {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(context ?? {})) out[k] = typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : JSON.stringify(v);
  return out;
}
