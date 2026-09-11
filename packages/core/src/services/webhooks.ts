import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { webhookDeliveries, webhooks, type Database } from "@evnelo/db";
import { newId } from "../ids";
import { WEBHOOK_EVENTS, WEBHOOK_RETRY_LIMIT, webhookRetryDelayMs, webhookSignedPayload, type WebhookEnvelope, type WebhookEvent } from "../webhooks";
import type { DbOrTx } from "./db";

/**
 * Outbound webhooks. `emitWebhookEvent` is called inside the transaction that produced the fact
 * (an order paid, a check-in) and only writes delivery rows; the job loop sends them with an
 * HMAC-SHA256 signature over `{timestamp}.{body}` and retries with backoff. Consumers verify with
 * `verifyWebhookSignature`.
 */

export type Webhook = typeof webhooks.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;

export const webhookInput = z.object({
  url: z.string().trim().url().max(500).refine((u) => u.startsWith("https://") || /^http:\/\/(localhost|127\.0\.0\.1)/.test(u), "Webhook URLs must use https"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  active: z.boolean().default(true),
});
export type WebhookInput = z.infer<typeof webhookInput>;

export function newWebhookSecret() {
  return `whsec_${randomBytes(29).toString("base64url")}`.slice(0, 64);
}

export async function createWebhook(db: Database, organizationId: string, input: WebhookInput) {
  const id = newId();
  await db.insert(webhooks).values({ id, organizationId, url: input.url, events: input.events, active: input.active, secret: newWebhookSecret() });
  const [row] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  return row!;
}

export async function updateWebhook(db: Database, organizationId: string, id: string, input: Partial<WebhookInput>) {
  const result = await db.update(webhooks).set({ ...(input.url ? { url: input.url } : {}), ...(input.events ? { events: input.events } : {}), ...(input.active != null ? { active: input.active } : {}) })
    .where(and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId)));
  if (Number((result[0] as { affectedRows?: number }).affectedRows ?? 0) === 0) return null;
  const [row] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  return row ?? null;
}

export async function rotateWebhookSecret(db: Database, organizationId: string, id: string) {
  const secret = newWebhookSecret();
  const result = await db.update(webhooks).set({ secret }).where(and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId)));
  return Number((result[0] as { affectedRows?: number }).affectedRows ?? 0) > 0 ? secret : null;
}

export async function listWebhooks(db: Database, organizationId: string) {
  return db.select().from(webhooks).where(eq(webhooks.organizationId, organizationId)).orderBy(desc(webhooks.createdAt));
}

export async function getWebhook(db: Database, organizationId: string, id: string) {
  const [row] = await db.select().from(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId))).limit(1);
  return row ?? null;
}

export async function deleteWebhook(db: Database, organizationId: string, id: string) {
  const result = await db.delete(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId)));
  return Number((result[0] as { affectedRows?: number }).affectedRows ?? 0) > 0;
}

/** Queue one delivery per active webhook subscribed to `type`. Safe inside the producing transaction. */
export async function emitWebhookEvent<T>(tx: DbOrTx, organizationId: string, type: WebhookEvent, data: T, now = new Date()) {
  const targets = await tx.select({ id: webhooks.id, events: webhooks.events }).from(webhooks).where(and(eq(webhooks.organizationId, organizationId), eq(webhooks.active, true)));
  const matching = targets.filter((w) => w.events.includes(type));
  if (!matching.length) return 0;
  const envelopeBase = { type, createdAt: now.toISOString(), organizationId, data };
  await tx.insert(webhookDeliveries).values(matching.map((w) => ({ id: newId(), webhookId: w.id, event: type, payload: { id: newId(), ...envelopeBase } satisfies WebhookEnvelope<T>, nextAttemptAt: now })));
  return matching.length;
}

/** Deliveries that are due, oldest first, with their webhook. Claims them by pushing `nextAttemptAt` so parallel workers don't double-send. */
export async function claimWebhookDeliveries(db: Database, now = new Date(), limit = 50, claimMs = 60_000) {
  const due = await db.select({ delivery: webhookDeliveries, webhook: webhooks }).from(webhookDeliveries)
    .innerJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId))
    .where(and(isNull(webhookDeliveries.deliveredAt), lte(webhookDeliveries.nextAttemptAt, now), eq(webhooks.active, true)))
    .orderBy(asc(webhookDeliveries.nextAttemptAt)).limit(limit);
  const claimed: typeof due = [];
  for (const row of due) {
    const r = await db.update(webhookDeliveries).set({ nextAttemptAt: new Date(now.getTime() + claimMs) })
      .where(and(eq(webhookDeliveries.id, row.delivery.id), eq(webhookDeliveries.nextAttemptAt, row.delivery.nextAttemptAt!)));
    if (Number((r[0] as { affectedRows?: number }).affectedRows ?? 0) === 1) claimed.push(row);
  }
  return claimed;
}

export function signWebhook(secret: string, timestamp: number, body: string) {
  return createHmac("sha256", secret).update(webhookSignedPayload(timestamp, body)).digest("hex");
}

/** For consumers (and our own tests): constant-time check plus a replay window. */
export function verifyWebhookSignature(secret: string, timestamp: number | string, body: string, signature: string, now = Date.now(), toleranceSeconds = 300) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > toleranceSeconds) return false;
  const expected = Buffer.from(signWebhook(secret, ts, body), "hex");
  const given = Buffer.from(signature.replace(/^v1=/, ""), "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Record the outcome of an attempt: success marks delivered; failure schedules a retry or gives up. */
export async function recordWebhookAttempt(db: Database, deliveryId: string, attempt: number, responseStatus: number | null, ok: boolean, now = new Date()) {
  if (ok) {
    await db.update(webhookDeliveries).set({ attempts: attempt, responseStatus, deliveredAt: now, nextAttemptAt: null }).where(eq(webhookDeliveries.id, deliveryId));
    return "delivered" as const;
  }
  if (attempt >= WEBHOOK_RETRY_LIMIT) {
    await db.update(webhookDeliveries).set({ attempts: attempt, responseStatus, nextAttemptAt: null }).where(eq(webhookDeliveries.id, deliveryId));
    return "failed" as const;
  }
  await db.update(webhookDeliveries).set({ attempts: attempt, responseStatus, nextAttemptAt: new Date(now.getTime() + webhookRetryDelayMs(attempt)) }).where(eq(webhookDeliveries.id, deliveryId));
  return "retry" as const;
}

/** Recent deliveries for the settings page / API. */
export async function listWebhookDeliveries(db: Database, organizationId: string, webhookId: string, limit = 50) {
  return db.select({ delivery: webhookDeliveries }).from(webhookDeliveries).innerJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId))
    .where(and(eq(webhookDeliveries.webhookId, webhookId), eq(webhooks.organizationId, organizationId)))
    .orderBy(desc(webhookDeliveries.createdAt)).limit(limit).then((rows) => rows.map((r) => r.delivery));
}

/** Failed-for-good deliveries (no next attempt, never delivered) for the settings page. */
export const webhookDeliveryState = (d: Pick<WebhookDelivery, "deliveredAt" | "nextAttemptAt" | "attempts">) => d.deliveredAt ? "delivered" : d.nextAttemptAt ? (d.attempts ? "retrying" : "pending") : "failed";

