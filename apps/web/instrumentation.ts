import type { Instrumentation } from "next";

export async function register() {
  // Keep the imports inside the check: webpack constant-folds NEXT_RUNTIME per layer, so the
  // edge bundle never pulls in mysql2 through the job loop.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLogExport, stopLogExport } = await import("./lib/telemetry");
    startLogExport();
    const { shutdownPosthog } = await import("./lib/posthog-server");
    const { migrateOnStart } = await import("./lib/migrate");
    await migrateOnStart(); // throws on failure: better a container that does not start than one on the wrong schema
    const { startJobLoop } = await import("./lib/notifications/loop");
    startJobLoop();
    // flush the last batch of events and logs when the container is stopped
    const drain = () => { void Promise.all([shutdownPosthog(), stopLogExport()]).finally(() => process.exit(0)); };
    process.once("SIGTERM", drain);
    process.once("SIGINT", drain);
  }
}

/**
 * Errors thrown while rendering or handling a request (server components, route handlers, actions).
 * The path is recorded without query string or fragment; the person, when the browser is
 * identified, comes from the PostHog cookie so the issue links to who hit it.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { posthogServer } = await import("./lib/posthog-server");
  const client = posthogServer();
  if (!client) return;
  const pathname = request.path.split("?")[0]?.split("#")[0] ?? request.path;
  client.captureException(error, distinctIdFromCookie(request.headers.cookie), {
    $pathname: pathname,
    method: request.method,
    routerKind: context.routerKind,
    routeType: context.routeType,
    routePath: context.routePath,
  });
};

/** posthog-js keeps `{ distinct_id }` in a cookie named after the project token when the user is identified. */
function distinctIdFromCookie(header: string | string[] | undefined) {
  const token = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? process.env.POSTHOG_KEY;
  const cookie = Array.isArray(header) ? header.join("; ") : header;
  if (!token || !cookie) return undefined;
  const match = cookie.match(new RegExp(`ph_${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_posthog=([^;]+)`));
  if (!match?.[1]) return undefined;
  try {
    const id = (JSON.parse(decodeURIComponent(match[1])) as { distinct_id?: unknown }).distinct_id;
    return typeof id === "string" ? id : undefined;
  } catch {
    return undefined;
  }
}
