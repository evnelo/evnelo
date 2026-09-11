import * as Sentry from "@sentry/nextjs";
import { env } from "./env";

export const errorReportingConfigured = Boolean(env.SENTRY_DSN);

/**
 * The one place unexpected failures go. Always logs (structured enough to grep in container
 * output); forwards to Sentry when SENTRY_DSN is set. `scope` is a stable dotted tag such as
 * "jobs.expireHolds" so alerts group by code path. Keep PII out of `context`: ids, not emails.
 */
export function captureError(scope: string, error: unknown, context?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
  console.error(`[${scope}] ${err.message}`, context ? JSON.stringify(context) : "", err.stack ? `\n${err.stack}` : "");
  if (errorReportingConfigured) Sentry.captureException(err, { tags: { scope }, extra: context });
}
