import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { smsUnlocks } from "@evnelo/db";
import { updateStripeAccountStatus } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyStripeWebhook } from "@/lib/stripe-webhook";
import { connectedAccountStatus } from "@/lib/stripe-connect";
import { applyRefund, settlePaymentIntent } from "@/lib/orders";
import { span } from "@/lib/posthog-server";

export const runtime = "nodejs";

/**
 * Stripe webhook. Idempotent: order state moves forward only, and every PaymentIntent status
 * goes through settlePaymentIntent so this handler, the resume endpoint and the job loop agree.
 * Fulfilment (tickets, emails) is queued by the service layer; nothing is sent from here.
 */
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig || (!env.STRIPE_WEBHOOK_SECRET && !env.STRIPE_CONNECT_WEBHOOK_SECRET)) return new NextResponse("missing signature", { status: 400 });

  let event;
  try {
    event = verifyStripeWebhook(await req.text(), sig, [env.STRIPE_WEBHOOK_SECRET, env.STRIPE_CONNECT_WEBHOOK_SECRET]);
  } catch {
    return new NextResponse("invalid signature", { status: 400 });
  }

  // Connect destinations can deliver test events to a live endpoint. Never mix payment modes.
  const live = /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? "");
  if (event.livemode !== live) return NextResponse.json({ received: true });

  await span(`stripe.webhook ${event.type}`, () => handle(event), { "stripe.event_id": event.id, "stripe.livemode": event.livemode });
  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "account.updated":
    case "account.application.deauthorized": {
      if (env.EDITION !== "cloud" || !event.account) break;
      // Re-read instead of applying a stale snapshot if Stripe delivers events out of order.
      const status = await connectedAccountStatus(event.account);
      await updateStripeAccountStatus(db, event.account, status === "ready");
      break;
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      if (!event.account && pi.metadata.smsUnlockEventId) {
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
}
