import posthog from "posthog-js";

/**
 * Browser analytics and error reporting. NEXT_PUBLIC_POSTHOG_KEY is inlined at build time, so an
 * image built without it ships no tracking. Requests go through the same-origin /relay rewrite.
 *
 * Two modes, decided by where the page load starts:
 * - public pages (event pages, checkout, tickets): cookieless. Nothing is stored in the browser;
 *   PostHog derives a daily, salted visitor hash on its side, so no consent banner is needed and
 *   attendees never become person profiles.
 * - the dashboard: a cookie-backed identity, identified as the signed-in user by
 *   components/analytics.tsx, so hosts' journeys can be followed across sessions.
 * The two never mix in one page load: the Dashboard links in the public chrome are full navigations.
 */
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (key) {
  const dashboard = window.location.pathname.startsWith("/dashboard");
  posthog.init(key, {
    api_host: "/relay",
    ui_host: (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com").replace(".i.posthog.com", ".posthog.com"),
    defaults: "2026-05-30",
    ...(dashboard ? { persistence: "localStorage+cookie" as const } : { cookieless_mode: "always" as const }),
    person_profiles: "identified_only",
    autocapture: false, // explicit events only: autocaptured element text could carry attendee names
    capture_exceptions: true,
    disable_session_recording: true,
  });
  // the same handle the snippet install exposes; lets you call posthog.debug() from the console in development
  if (process.env.NODE_ENV !== "production") (window as unknown as { posthog?: typeof posthog }).posthog = posthog;
}
