"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import type { AnalyticsEvent } from "@/lib/analytics-events";

const enabled = () => Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY) && posthog.__loaded;

/** Record a product event from the browser. A no-op without PostHog. */
export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  if (enabled()) posthog.capture(event, properties);
}

/** Records `event` once when the page it sits on is shown. Use in server components for page-level events. */
export function Track({ event, properties }: { event: AnalyticsEvent; properties?: Record<string, unknown> }) {
  const json = JSON.stringify(properties ?? {});
  useEffect(() => { track(event, JSON.parse(json)); }, [event, json]);
  return null;
}

/**
 * The dashboard's identity: the signed-in user and their organization as a group. Ids only, no
 * email or name as person properties. Skipped when the SDK is in cookieless mode (a page load that
 * started on the public site), because cookieless sessions cannot be identified.
 */
export function IdentifyUser({ userId, organizationId, organizationName, role }: { userId: string; organizationId: string; organizationName: string; role: string }) {
  useEffect(() => {
    if (!enabled() || posthog.config.cookieless_mode) return;
    posthog.identify(userId);
    posthog.group("organization", organizationId, { name: organizationName });
    posthog.register({ role });
  }, [userId, organizationId, organizationName, role]);
  return null;
}
