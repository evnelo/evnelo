import * as Sentry from "@sentry/nextjs";

/**
 * Server-side Sentry. Loaded from instrumentation.ts in the Node runtime only. A no-op without
 * SENTRY_DSN, so self-hosters who don't want error reporting change nothing.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}
