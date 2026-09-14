"use client";

import posthog from "posthog-js";

/**
 * Called from error boundaries. Server-side errors (they carry a `digest`) are already reported by
 * instrumentation.onRequestError with the real stack; the browser only sees a redacted message for
 * those, so only client-originated errors are sent from here.
 */
export function reportClientError(error: Error & { digest?: string }) {
  if (error.digest || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.captureException(error);
}
