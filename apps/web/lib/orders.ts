/**
 * Stripe-aware order operations: thin bindings of the core fulfilment services plus the few
 * places that must talk to Stripe (cancel, refund, retrieve). Business rules stay in @evnelo/core.
 */
import { captureError } from "@/lib/observability";
import type Stripe from "stripe";
import { events, orders, type Order } from "@evnelo/db";
import { eq } from "drizzle-orm";
import * as svc from "@evnelo/core/services";
import { db } from "./db";
import { env } from "./env";
import { stripe } from "./stripe";
import { EVENTS } from "@/lib/analytics-events";
import { track } from "@/lib/posthog-server";

export const markOrderPaid = (paymentIntentId: string) => svc.markOrderPaid(db, paymentIntentId);
export const markOrderProcessing = (paymentIntentId: string) => svc.markOrderProcessing(db, paymentIntentId);
export const releaseOrder = (orderId: string, status: "failed" | "expired") => svc.releaseOrder(db, orderId, status);
export const releaseOrderByPaymentIntent = (paymentIntentId: string, status: "failed" | "expired", from?: svc.ReleasableStatus[]) =>
  svc.releaseOrderByPaymentIntent(db, paymentIntentId, status, from);
export const fulfilFreeOrder = (orderId: string) => svc.fulfilFreeOrder(db, orderId);

/** Requests for an existing PaymentIntent go to the account it was created on, recorded on the order. */
const on = (stripeAccountId: string | null | undefined) => (stripeAccountId ? { stripeAccount: stripeAccountId } : undefined);

/** Refund a payment that landed after its seats were released. Idempotent per intent, safe to call from every path. */
export async function refundLatePayment(paymentIntentId: string, stripeAccountId: string | null | undefined) {
  await stripe.refunds.create({ payment_intent: paymentIntentId }, { idempotencyKey: `late-payment-refund:${paymentIntentId}`, ...on(stripeAccountId) });
}

export type SettleResult = "paid" | "processing" | "expired" | "failed" | "ignored";

/**
 * Card brand, last digits and Stripe's own receipt, for the buyer's receipt. Runs before
 * markOrderPaid because that transaction queues the confirmation email. Best effort: a
 * failed lookup never blocks fulfilment, and a replay (webhook after resume) skips the call.
 */
async function recordPayment(pi: Pick<Stripe.PaymentIntent, "id"> & { latest_charge?: Stripe.PaymentIntent["latest_charge"] }, stripeAccountId: string | null | undefined) {
  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
  if (!chargeId) return;
  try {
    const [order] = await db.select({ recorded: orders.paymentMethodType }).from(orders).where(eq(orders.stripePaymentIntentId, pi.id)).limit(1);
    if (!order || order.recorded) return;
    const charge = typeof pi.latest_charge === "object" && pi.latest_charge ? pi.latest_charge : await stripe.charges.retrieve(chargeId, {}, on(stripeAccountId));
    const details = charge.payment_method_details;
    await svc.recordOrderPayment(db, pi.id, {
      paymentMethodType: details?.type ?? null,
      paymentMethodBrand: details?.card?.brand ?? null,
      paymentMethodLast4: details?.card?.last4 ?? null,
      stripeReceiptUrl: charge.receipt_url ?? null,
    });
  } catch (error) {
    captureError("orders.recordPayment", error, { paymentIntentId: pi.id });
  }
}

/**
 * Apply a PaymentIntent's current Stripe status to its order. The single place the webhook,
 * the resume endpoint, the hold sweep and reconciliation agree on what each status means.
 */
export async function settlePaymentIntent(pi: Pick<Stripe.PaymentIntent, "id" | "status"> & { latest_charge?: Stripe.PaymentIntent["latest_charge"] }, stripeAccountId: string | null | undefined): Promise<SettleResult> {
  switch (pi.status) {
    case "succeeded": {
      await recordPayment(pi, stripeAccountId);
      const result = await markOrderPaid(pi.id);
      if (result === "expired") await refundLatePayment(pi.id, stripeAccountId); // seats were already released: the rare race
      if (result === "paid") await trackOrder(pi.id, EVENTS.paymentSucceeded);
      return result;
    }
    case "processing":
      return markOrderProcessing(pi.id);
    case "canceled": {
      const released = await releaseOrderByPaymentIntent(pi.id, "failed");
      if (released) await trackOrder(pi.id, EVENTS.paymentFailed, { reason: "canceled" });
      return released ? "failed" : "ignored";
    }
    case "requires_payment_method":
      // a delayed method was verified and then bounced; a card decline before the hold lapses stays retryable
      return (await releaseOrderByPaymentIntent(pi.id, "failed", ["processing"])) ? "failed" : "ignored";
    default:
      return "ignored"; // requires_action / requires_confirmation / requires_capture: still in flight
  }
}

/** The anonymous checkout funnel keys on the order id; the organization is the group. */
async function trackOrder(paymentIntentId: string, event: typeof EVENTS.paymentSucceeded | typeof EVENTS.paymentFailed, properties?: Record<string, unknown>) {
  const [row] = await db.select({ id: orders.id, eventId: orders.eventId, totalMinor: orders.totalMinor, currency: orders.currency, organizationId: events.organizationId })
    .from(orders).innerJoin(events, eq(orders.eventId, events.id)).where(eq(orders.stripePaymentIntentId, paymentIntentId)).limit(1);
  if (row) track(event, { distinctId: row.id, anonymous: true, organizationId: row.organizationId, properties: { eventId: row.eventId, amountMinor: row.totalMinor, currency: row.currency, ...properties } });
}

/**
 * Lapsed holds: cancel the PaymentIntent at Stripe first so a released seat can never be paid
 * for afterwards. If Stripe reports the intent already succeeded or is processing, settle it
 * instead of releasing. Runs from the job loop.
 */
export const expireHolds = () => svc.expireHolds(db, async (order) => {
  if (!order.stripePaymentIntentId) return true;
  try {
    await stripe.paymentIntents.cancel(order.stripePaymentIntentId, {}, on(order.stripeAccountId));
    return true;
  } catch (cancelError) {
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId, {}, on(order.stripeAccountId));
    } catch (retrieveError) {
      captureError("jobs.expireHolds.retrieveIntent", retrieveError, { orderId: order.id });
      return false;
    }
    if (intent.status === "canceled") return true;
    const result = await settlePaymentIntent(intent, order.stripeAccountId);
    if (result === "ignored") captureError("jobs.expireHolds.cancelIntent", cancelError, { orderId: order.id, intentStatus: intent.status });
    return false;
  }
});

/**
 * Delayed-payment orders waiting on Stripe: re-check each one roughly hourly in case the
 * terminal webhook never arrived (endpoint down, secret rotated). Runs from the job loop.
 */
export async function reconcileProcessingOrders() {
  const stale = await svc.staleProcessingOrders(db, new Date(Date.now() - 60 * 60_000));
  let settled = 0;
  for (const order of stale) {
    if (!order.stripePaymentIntentId) continue;
    try {
      const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId, {}, on(order.stripeAccountId));
      if ((await settlePaymentIntent(intent, order.stripeAccountId)) !== "ignored") settled++;
    } catch (error) {
      captureError("jobs.reconcileProcessingOrders", error, { orderId: order.id });
    }
  }
  return settled;
}

export async function applyRefund(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;
  await svc.applyRefund(db, { paymentIntentId: piId, amountRefunded: charge.amount_refunded, amount: charge.amount });
}

export type RefundRequest =
  | { ok: true; order: Order }
  | { ok: false; reason: "not_found" | "no_payment" | "not_refundable"; message: string };

/**
 * Ask Stripe for a full refund. The order itself is updated by the `charge.refunded` webhook
 * (`applyRefund`: party cancelled, tickets revoked, seats returned), so the state is only ever
 * derived from Stripe. Same rule as the dashboard refund action; shared with the REST API.
 */
export async function requestFullRefund(eventId: string, orderId: string): Promise<RefundRequest> {
  const order = await svc.getOrder(db, eventId, orderId);
  if (!order) return { ok: false, reason: "not_found", message: "Order not found." };
  if (!order.stripePaymentIntentId) return { ok: false, reason: "no_payment", message: "This order has no payment to refund." };
  if (order.status !== "paid" && order.status !== "partially_refunded") return { ok: false, reason: "not_refundable", message: `Order is ${order.status}; nothing to refund.` };
  await stripe.refunds.create(
    { payment_intent: order.stripePaymentIntentId },
    env.EDITION === "cloud" && order.stripeAccountId ? { stripeAccount: order.stripeAccountId } : undefined,
  );
  return { ok: true, order };
}
