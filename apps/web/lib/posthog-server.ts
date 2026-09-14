import { PostHog } from "posthog-node";
import { env } from "./env";
import type { AnalyticsEvent } from "./analytics-events";

const g = globalThis as unknown as { __evPosthog?: PostHog | null };

/**
 * The server-side PostHog client: product events, exceptions and spans. One instance per process
 * (kept on globalThis so dev reloads do not leak clients); null when POSTHOG_KEY is unset, and every
 * helper below is then a no-op, so self-hosters who do not want analytics change nothing.
 */
export function posthogServer(): PostHog | null {
  if (g.__evPosthog !== undefined) return g.__evPosthog;
  if (!env.POSTHOG_KEY) return (g.__evPosthog = null);
  g.__evPosthog = new PostHog(env.POSTHOG_KEY!, {
    host: env.POSTHOG_HOST,
    flushAt: 20,
    flushInterval: 10_000,
    traces: { serviceName: "evnelo-web", environment: env.POSTHOG_ENVIRONMENT ?? process.env.NODE_ENV, serviceVersion: process.env.APP_VERSION },
  });
  return g.__evPosthog;
}

type TrackArgs = {
  /** A host: their user id. An attendee: the order id (or another non-personal id); pass `anonymous: true`. */
  distinctId: string;
  properties?: Record<string, unknown>;
  /** Organization the event belongs to; PostHog group analytics keys on it. */
  organizationId?: string | null;
  /** No person profile is created or updated: attendee-side events. */
  anonymous?: boolean;
};

/** Record a product event from the server. Fire and forget; the client batches. */
export function track(event: AnalyticsEvent, { distinctId, properties, organizationId, anonymous }: TrackArgs) {
  const client = posthogServer();
  if (!client) return;
  client.capture({
    distinctId,
    event,
    properties: { ...properties, ...(anonymous ? { $process_person_profile: false } : {}) },
    ...(organizationId ? { groups: { organization: organizationId } } : {}),
  });
}

/** Run `fn` inside a named span (a trace in PostHog); without PostHog it just runs. */
export async function span<T>(name: string, fn: () => Promise<T>, attributes?: Record<string, string | number | boolean>): Promise<T> {
  const client = posthogServer();
  if (!client) return fn();
  return client.withSpan(name, async (s) => {
    if (attributes) for (const [k, v] of Object.entries(attributes)) s.setAttribute(k, v);
    return fn();
  });
}

/** Flush queued events; called on shutdown so the last batch is not lost. */
export async function shutdownPosthog() {
  const client = g.__evPosthog;
  g.__evPosthog = undefined;
  if (client) await client.shutdown().catch(() => undefined);
}
