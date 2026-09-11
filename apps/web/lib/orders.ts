/**
 * Stripe-aware order operations: thin bindings of the core fulfilment services plus the few
 * places that must talk to Stripe (cancel, refund, retrieve). Business rules stay in @evnelo/core.
 */
import { captureError } from "@/lib/observability";
import type Stripe from "stripe";
import type { Order } from "@evnelo/db";
import * as svc from "@evnelo/core/services";
import { db } from "./db";
import { env } from "./env";
import { stripe } from "./stripe";

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
 * Apply a PaymentIntent's current Stripe status to its order. The single place the webhook,
 * the resume endpoint, the hold sweep and reconciliation agree on what each status means.
 */
export async function settlePaymentIntent(pi: Pick<Stripe.PaymentIntent, "id" | "status">, stripeAccountId: string | null | undefined): Promise<SettleResult> {
  switch (pi.status) {
    case "succeeded": {
      const result = await markOrderPaid(pi.id);
      if (result === "expired") await refundLatePayment(pi.id, stripeAccountId); // seats were already released: the rare race
      return result;
    }
    case "processing":
      return markOrderProcessing(pi.id);
    case "canceled":
      return (await releaseOrderByPaymentIntent(pi.id, "failed")) ? "failed" : "ignored";
    case "requires_payment_method":
      // a delayed method was verified and then bounced; a card decline before the hold lapses stays retryable
      return (await releaseOrderByPaymentIntent(pi.id, "failed", ["processing"])) ? "failed" : "ignored";
    default:
      return "ignored"; // requires_action / requires_confirmation / requires_capture: still in flight
  }
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
