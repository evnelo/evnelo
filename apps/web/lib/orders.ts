/**
 * Thin binding of the core fulfilment services to this app's database and Stripe connection.
 * Business logic lives in @ot/core/services so the REST API and MCP server share it.
 */
import type Stripe from "stripe";
import * as svc from "@ot/core/services";
import { currentEdition } from "@ot/core";
import { db } from "./db";
import { env } from "./env";
import { checkoutStripeAccount } from "./payment-flow";
import { stripe } from "./stripe";

export const markOrderPaid = (paymentIntentId: string, settledAt?: Date) => svc.markOrderPaid(db, paymentIntentId, settledAt);
export const markOrderProcessing = (paymentIntentId: string) => svc.markOrderProcessing(db, paymentIntentId);
export const releaseOrder = (orderId: string, status: "failed" | "expired") => svc.releaseOrder(db, orderId, status);
export const releaseOrderByPaymentIntent = (paymentIntentId: string, status: "failed" | "expired") => svc.releaseOrderByPaymentIntent(db, paymentIntentId, status);
export const fulfilFreeOrder = (orderId: string) => svc.fulfilFreeOrder(db, orderId);

/** Cancel Stripe before returning held inventory so an expired intent cannot be paid late. */
export const expireHolds = () => svc.expireHolds(db, async (order) => {
  if (!order.stripePaymentIntentId) return true;
  const stripeAccountId = checkoutStripeAccount(currentEdition(), order.stripeAccountId);
  const options = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;
  try {
    await stripe.paymentIntents.cancel(order.stripePaymentIntentId, {}, options);
    return true;
  } catch (cancelError) {
    try {
      const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId, { expand: ["latest_charge"] }, options);
      if (intent.status === "succeeded") {
        const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
        const result = await svc.markOrderPaid(db, intent.id, charge ? new Date(charge.created * 1000) : undefined);
        if (result === "expired") {
          await stripe.refunds.create(
            { payment_intent: intent.id },
            { idempotencyKey: `late-payment-refund:${intent.id}`, ...(stripeAccountId ? { stripeAccount: stripeAccountId } : {}) },
          );
        }
        return false;
      }
      if (intent.status === "canceled") return true;
    } catch (retrieveError) {
      console.error("expireHolds: unable to verify Stripe intent", retrieveError);
      return false;
    }
    console.error("expireHolds: unable to cancel Stripe intent", cancelError);
    return false;
  }
});

export async function applyRefund(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;
  await svc.applyRefund(db, { paymentIntentId: piId, amountRefunded: charge.amount_refunded, amount: charge.amount });
}
