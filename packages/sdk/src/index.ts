import { createHmac, timingSafeEqual } from "node:crypto";
import createClient, { type ClientOptions } from "openapi-fetch";
import type { components, paths } from "./schema";

export type { components, paths } from "./schema";
/** Response and input objects by name, e.g. `Schemas["Event"]`. */
export type Schemas = components["schemas"];

export type OpenTicketClientOptions = {
  /** Instance origin, e.g. `https://tickets.example.com`. The `/api/v1` prefix is added when missing. */
  baseUrl: string;
  /** `ot_live_…` key from Dashboard → Settings → API keys. Optional for the public endpoints. */
  apiKey?: string;
  /** Custom fetch (tests, proxies). Defaults to the global fetch. */
  fetch?: ClientOptions["fetch"];
  /** Extra headers on every request. */
  headers?: Record<string, string>;
};

export function apiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

/**
 * Typed client over the REST API: `client.GET("/events/{id}", { params: { path: { id } } })`.
 * Paths, parameters, bodies and responses come from the generated schema; a wrong path or
 * missing field is a compile error. Responses are `{ data, error, response }`.
 */
export function createOpenTicketClient(options: OpenTicketClientOptions) {
  return createClient<paths>({
    baseUrl: apiBaseUrl(options.baseUrl),
    fetch: options.fetch,
    headers: { ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}), ...options.headers },
  });
}
export type OpenTicketClient = ReturnType<typeof createOpenTicketClient>;

/* ---------- outbound webhooks ---------- */

/** Mirrors the contract in packages/core/src/webhooks.ts (the SDK does not depend on core). */
export const WEBHOOK_SIGNATURE_HEADER = "openticket-signature";
export const WEBHOOK_TIMESTAMP_HEADER = "openticket-timestamp";
export const WEBHOOK_ID_HEADER = "openticket-delivery-id";
export const WEBHOOK_TOLERANCE_SECONDS = 300;

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

export type WebhookEnvelope<T = unknown> = { id: string; type: WebhookEvent; createdAt: string; organizationId: string; data: T };

export function webhookSignedPayload(timestamp: number | string, body: string): string {
  return `${timestamp}.${body}`;
}

export function signWebhook(secret: string, timestamp: number | string, body: string): string {
  return createHmac("sha256", secret).update(webhookSignedPayload(timestamp, body)).digest("hex");
}

/**
 * Constant-time check of `openticket-signature` (hex HMAC-SHA256 of `{timestamp}.{rawBody}`,
 * optionally prefixed `v1=`) with a replay window around `openticket-timestamp` (unix seconds).
 * Pass the raw request body, not a re-serialized object.
 */
export function verifyWebhookSignature(secret: string, timestamp: number | string, body: string, signature: string, now = Date.now(), toleranceSeconds = WEBHOOK_TOLERANCE_SECONDS): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > toleranceSeconds) return false;
  const expected = Buffer.from(signWebhook(secret, ts, body), "hex");
  const given = Buffer.from(signature.replace(/^v1=/, ""), "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Same check straight from a request's headers; returns the parsed envelope or null. */
export function verifyWebhookRequest<T = unknown>(secret: string, headers: { get(name: string): string | null }, rawBody: string, now = Date.now()): WebhookEnvelope<T> | null {
  const signature = headers.get(WEBHOOK_SIGNATURE_HEADER);
  const timestamp = headers.get(WEBHOOK_TIMESTAMP_HEADER);
  if (!signature || !timestamp || !verifyWebhookSignature(secret, timestamp, rawBody, signature, now)) return null;
  return JSON.parse(rawBody) as WebhookEnvelope<T>;
}
