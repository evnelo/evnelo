/**
 * Stripe-aware order operations: thin bindings of the core fulfilment services plus the few
 * places that must talk to Stripe (cancel, refund, retrieve). Business rules stay in @ot/core.
 */
import type Stripe from "stripe";
import * as svc from "@ot/core/services";
import { db } from "./db";
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
      console.error("expireHolds: unable to verify Stripe intent", retrieveError);
      return false;
    }
    if (intent.status === "canceled") return true;
    const result = await settlePaymentIntent(intent, order.stripeAccountId);
    if (result === "ignored") console.error("expireHolds: unable to cancel Stripe intent", intent.status, cancelError);
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
      console.error("reconcileProcessingOrders", order.id, error);
    }
  }
  return settled;
}

export async function applyRefund(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;
  await svc.applyRefund(db, { paymentIntentId: piId, amountRefunded: charge.amount_refunded, amount: charge.amount });
}
