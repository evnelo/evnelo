import type { Instrumentation } from "next";

export async function register() {
  // Keep the imports inside the check: webpack constant-folds NEXT_RUNTIME per layer, so the
  // edge bundle never pulls in mysql2 through the job loop.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    const { migrateOnStart } = await import("./lib/migrate");
    await migrateOnStart(); // throws on failure: better a container that does not start than one on the wrong schema
    const { startJobLoop } = await import("./lib/notifications/loop");
    startJobLoop();
  }
}

/** Errors thrown while rendering or handling a request (server components, route handlers, actions). */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(...args);
  }
};
