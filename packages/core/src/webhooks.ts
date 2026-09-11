/**
 * Outbound webhook contract. Pure: shared by the delivery worker, the REST API, the
 * SDK docs and tests. Delivery itself lives in packages/core/src/services/webhooks.ts.
 */

export const WEBHOOK_EVENTS = [
  "registration.created",
  "order.paid",
  "order.refunded",
  "attendee.checked_in",
  "event.published",
  "event.updated",
  "event.cancelled",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_RETRY_LIMIT = 8;

/** Backoff before the next attempt: 1, 2, 4, … minutes, capped at 6 hours. */
export function webhookRetryDelayMs(attempt: number): number {
  return Math.min(2 ** Math.max(attempt - 1, 0) * 60_000, 6 * 3_600_000);
}

/** Header names, and the string that gets signed: `{timestamp}.{body}`. */
export const WEBHOOK_SIGNATURE_HEADER = "evnelo-signature";
export const WEBHOOK_TIMESTAMP_HEADER = "evnelo-timestamp";
export const WEBHOOK_ID_HEADER = "evnelo-delivery-id";
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export function webhookSignedPayload(timestamp: number | string, body: string): string {
  return `${timestamp}.${body}`;
}

export type WebhookEnvelope<T = unknown> = {
  id: string;
  type: WebhookEvent;
  createdAt: string;
  organizationId: string;
  data: T;
};
