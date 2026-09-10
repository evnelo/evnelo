import { NextResponse } from "next/server";
import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { attendees, orders } from "@ot/db";
import { currentEdition } from "@ot/core";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { checkoutStripeAccount } from "@/lib/payment-flow";
import { paymentResumeMatches, verifyPaymentResume } from "@/lib/payment-resume";
import { stripe } from "@/lib/stripe";
import { markOrderPaid, markOrderProcessing, releaseOrderByPaymentIntent } from "@/lib/orders";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { ApiHttpError, readJsonBody } from "@/lib/api-http";

export const runtime = "nodejs";
const input = z.object({ token: z.string().min(1).max(1_000), clientSecret: z.string().min(1).max(500), eventId: z.string().length(26) });

export async function POST(request: Request) {
  let data: unknown;
  try {
    data = await readJsonBody(request, 2_048);
  } catch (error) {
    const status = error instanceof ApiHttpError ? error.status : 400;
    return NextResponse.json({ error: "Invalid payment-resume request." }, { status });
  }
  const parsed = input.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment-resume request." }, { status: 400 });

  try {
    const resume = await verifyPaymentResume(parsed.data.token, env.AUTH_SECRET);
    if (!(await consumeSharedRateLimit("payment-resume", resume.orderId, 30, 60_000))) {
      return NextResponse.json({ error: "Too many payment checks. Wait a minute and try again." }, { status: 429 });
    }
    if (resume.eventId !== parsed.data.eventId) return NextResponse.json({ error: "Payment session not found." }, { status: 404 });
    const [order] = await db.select().from(orders).where(and(eq(orders.id, resume.orderId), eq(orders.eventId, resume.eventId))).limit(1);
    if (!order || !paymentResumeMatches(resume, order, parsed.data.clientSecret) || !order.stripePaymentIntentId) {
      return NextResponse.json({ error: "Payment session not found." }, { status: 404 });
    }
    const stripeAccountId = checkoutStripeAccount(currentEdition(), order.stripeAccountId);
    const paymentIntent = await stripe.paymentIntents.retrieve(
      order.stripePaymentIntentId,
      { expand: ["latest_charge"] },
      stripeAccountId ? { stripeAccount: stripeAccountId } : undefined,
    );
    if (paymentIntent.client_secret !== parsed.data.clientSecret || paymentIntent.metadata.orderId !== order.id) {
      return NextResponse.json({ error: "Payment session not found." }, { status: 404 });
    }
    let orderStatus = order.status;
    let holdExpiresAt = order.holdExpiresAt;
    if (paymentIntent.status === "processing") {
      const result = await markOrderProcessing(paymentIntent.id);
      orderStatus = result === "processing" ? "processing" : result === "expired" ? "expired" : orderStatus;
      if (result === "processing") holdExpiresAt = null;
      if (result === "expired") {
        await stripe.paymentIntents.cancel(paymentIntent.id, {}, stripeAccountId ? { stripeAccount: stripeAccountId } : undefined).catch(() => undefined);
      }
    } else if (paymentIntent.status === "succeeded") {
      const charge = typeof paymentIntent.latest_charge === "object" ? paymentIntent.latest_charge : null;
      const result = await markOrderPaid(paymentIntent.id, charge ? new Date(charge.created * 1000) : undefined);
      orderStatus = result === "paid" ? "paid" : result === "expired" ? "expired" : orderStatus;
      holdExpiresAt = null;
      if (result === "expired") {
        await stripe.refunds.create(
          { payment_intent: paymentIntent.id },
          { idempotencyKey: `late-payment-refund:${paymentIntent.id}`, ...(stripeAccountId ? { stripeAccount: stripeAccountId } : {}) },
        );
      }
    } else if ((paymentIntent.status === "requires_payment_method" || paymentIntent.status === "canceled") && orderStatus === "processing") {
      await releaseOrderByPaymentIntent(paymentIntent.id, "failed");
      orderStatus = "failed";
      holdExpiresAt = null;
    }
    const [[party], [pendingApproval]] = await Promise.all([
      db.select({ value: count() }).from(attendees).where(and(eq(attendees.orderId, order.id), isNull(attendees.deletedAt))),
      db.select({ value: count() }).from(attendees).where(and(eq(attendees.orderId, order.id), eq(attendees.status, "pending_approval"), isNull(attendees.deletedAt))),
    ]);
    return NextResponse.json({
      orderId: order.id,
      clientSecret: parsed.data.clientSecret,
      stripeAccountId,
      partySize: Number(party?.value ?? 1),
      requiresApproval: Number(pendingApproval?.value ?? 0) > 0,
      holdExpiresAt: holdExpiresAt?.toISOString() ?? null,
      orderStatus,
      paymentStatus: paymentIntent.status,
    });
  } catch {
    return NextResponse.json({ error: "Payment session could not be verified." }, { status: 400 });
  }
}
