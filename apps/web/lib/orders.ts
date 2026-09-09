/**
 * Thin binding of the core fulfilment services to this app's database connection.
 * Business logic lives in @ot/core/services so the REST API and MCP server share it.
 */
import type Stripe from "stripe";
import * as svc from "@ot/core/services";
import { db } from "./db";

export const markOrderPaid = (paymentIntentId: string) => svc.markOrderPaid(db, paymentIntentId);
export const releaseOrder = (orderId: string, status: "failed" | "expired") => svc.releaseOrder(db, orderId, status);
export const releaseOrderByPaymentIntent = (paymentIntentId: string, status: "failed" | "expired") => svc.releaseOrderByPaymentIntent(db, paymentIntentId, status);
export const expireHolds = () => svc.expireHolds(db);
export const fulfilFreeOrder = (orderId: string) => svc.fulfilFreeOrder(db, orderId);

export async function applyRefund(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;
  await svc.applyRefund(db, { paymentIntentId: piId, amountRefunded: charge.amount_refunded, amount: charge.amount });
}
