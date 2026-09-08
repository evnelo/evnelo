import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { smsUnlocks } from "@ot/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { applyRefund, markOrderPaid, releaseOrderByPaymentIntent } from "@/lib/orders";

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
      await markOrderPaid(pi.id);
      break;
    }
    case "payment_intent.payment_failed": {
      // One attempt failed (declined card etc.). The PaymentIntent is still confirmable
      // with another method, so the order stays pending until its hold expires.
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
