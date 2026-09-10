import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { smsUnlocks } from "@ot/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { applyRefund, settlePaymentIntent } from "@/lib/orders";

export const runtime = "nodejs";

/**
 * Stripe webhook. Idempotent: order state moves forward only, and every PaymentIntent status
 * goes through settlePaymentIntent so this handler, the resume endpoint and the job loop agree.
 * Fulfilment (tickets, emails) is queued by the service layer; nothing is sent from here.
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
      await settlePaymentIntent(pi, event.account ?? null);
      break;
    }
    case "payment_intent.processing":
    case "payment_intent.canceled":
    case "payment_intent.payment_failed":
      await settlePaymentIntent(event.data.object, event.account ?? null);
      break;
    case "charge.refunded":
      await applyRefund(event.data.object);
      break;
  }
  return NextResponse.json({ received: true });
}
