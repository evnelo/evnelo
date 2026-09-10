import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { orders, smsUnlocks } from "@ot/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { applyRefund, markOrderPaid, markOrderProcessing, releaseOrderByPaymentIntent } from "@/lib/orders";

export const runtime = "nodejs";

/**
 * Stripe webhook. Idempotent: order state moves forward only.
 * Fulfilment (issuing tickets, sending email/SMS) is enqueued in the service layer
 * by markOrderPaid — this handler never sends anything itself.
 */
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig || !env.STRIPE_WEBHOOK_SECRET) return new NextResponse("missing signature", { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return new NextResponse(`invalid signature: ${(e as Error).message}`, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      if (pi.metadata.smsUnlockEventId) {
        await db.update(smsUnlocks).set({ paidAt: new Date(), stripePaymentIntentId: pi.id })
          .where(eq(smsUnlocks.eventId, pi.metadata.smsUnlockEventId));
        break;
      }
      const result = await markOrderPaid(pi.id, new Date(event.created * 1000));
      if (result === "expired") {
        await stripe.refunds.create(
          { payment_intent: pi.id },
          { idempotencyKey: `late-payment-refund:${pi.id}`, ...(event.account ? { stripeAccount: event.account } : {}) },
        );
      }
      break;
    }
    case "payment_intent.processing": {
      const result = await markOrderProcessing(event.data.object.id);
      if (result === "expired") {
        await stripe.paymentIntents.cancel(
          event.data.object.id,
          {},
          event.account ? { stripeAccount: event.account } : undefined,
        ).catch(() => undefined);
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const [order] = await db.select({ status: orders.status }).from(orders).where(eq(orders.stripePaymentIntentId, event.data.object.id)).limit(1);
      if (order?.status === "processing") await releaseOrderByPaymentIntent(event.data.object.id, "failed");
      // A normal card attempt may still be retried while its short hold is active.
      break;
    }
    case "payment_intent.canceled": {
      await releaseOrderByPaymentIntent(event.data.object.id, "failed");
      break;
    }
    case "charge.refunded": {
      await applyRefund(event.data.object);
      break;
    }
  }
  return NextResponse.json({ received: true });
}
