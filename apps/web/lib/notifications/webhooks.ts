import { claimWebhookDeliveries, recordWebhookAttempt, signWebhook } from "@ot/core/services";
import { WEBHOOK_ID_HEADER, WEBHOOK_RETRY_LIMIT, WEBHOOK_SIGNATURE_HEADER, WEBHOOK_TIMESTAMP_HEADER } from "@ot/core";
import { db } from "@/lib/db";
import { captureError } from "@/lib/observability";

const TIMEOUT_MS = 10_000;

/**
 * One pass of outbound webhook delivery: POST each due delivery with an HMAC signature; a 2xx
 * marks it delivered, anything else (or a timeout) schedules a retry with backoff, and after
 * WEBHOOK_RETRY_LIMIT attempts the delivery is marked failed and reported once.
 */
export async function deliverWebhooks() {
  const claimed = await claimWebhookDeliveries(db);
  const stats = { delivered: 0, retried: 0, failed: 0 };
  for (const { delivery, webhook } of claimed) {
    const attempt = delivery.attempts + 1;
    const body = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000);
    let status: number | null = null;
    let ok = false;
    try {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "OpenTicket-Webhooks/1.0",
          [WEBHOOK_ID_HEADER]: delivery.id,
          [WEBHOOK_TIMESTAMP_HEADER]: String(timestamp),
          [WEBHOOK_SIGNATURE_HEADER]: `v1=${signWebhook(webhook.secret, timestamp, body)}`,
        },
        body,
        redirect: "manual", // never follow a redirect with a signed body
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = res.status;
      ok = res.status >= 200 && res.status < 300;
      await res.body?.cancel().catch(() => undefined);
    } catch {
      ok = false;
    }
    const outcome = await recordWebhookAttempt(db, delivery.id, attempt, status, ok);
    stats[outcome === "delivered" ? "delivered" : outcome === "retry" ? "retried" : "failed"]++;
    if (outcome === "failed") captureError("webhooks.deliveryFailed", new Error(`webhook ${webhook.id} gave up after ${WEBHOOK_RETRY_LIMIT} attempts (last status ${status ?? "network error"})`), { webhookId: webhook.id, deliveryId: delivery.id, event: delivery.event });
  }
  return stats;
}
