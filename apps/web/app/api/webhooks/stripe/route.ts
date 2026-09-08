import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { orders, smsUnlocks } from "@ot/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";

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
      const { markOrderPaid } = await import("@/lib/orders");
      await markOrderPaid(pi.id);
      break;
    }
    case "payment_intent.payment_failed": {
      await db.update(orders).set({ status: "failed" }).where(eq(orders.stripePaymentIntentId, event.data.object.id));
      break;
    }
    case "charge.refunded": {
      const { applyRefund } = await import("@/lib/orders");
      await applyRefund(event.data.object);
      break;
    }
  }
  return NextResponse.json({ received: true });
}
