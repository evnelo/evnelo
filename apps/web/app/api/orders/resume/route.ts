import { NextResponse } from "next/server";
import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { attendees, orders } from "@ot/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { paymentResumeMatches, verifyPaymentResume } from "@/lib/payment-resume";
import { stripe } from "@/lib/stripe";
import { settlePaymentIntent } from "@/lib/orders";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { ApiHttpError, readJsonBody } from "@/lib/api-http";

export const runtime = "nodejs";
const input = z.object({ token: z.string().min(1).max(1_000), clientSecret: z.string().min(1).max(500), eventId: z.string().length(26) });

/**
 * The browser's only way to learn whether a payment landed. It never asserts success itself:
 * the signed token + client secret identify the order, Stripe is asked for the intent's real
 * status, and the order is settled server-side before the state is returned.
 */
export async function POST(request: Request) {
  let data: unknown;
  try {
    data = await readJsonBody(request, 2_048);
  } catch (error) {
    return NextResponse.json({ error: "Invalid payment-resume request." }, { status: error instanceof ApiHttpError ? error.status : 400 });
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
    const paymentIntent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId, {}, order.stripeAccountId ? { stripeAccount: order.stripeAccountId } : undefined);
    if (paymentIntent.client_secret !== parsed.data.clientSecret || paymentIntent.metadata.orderId !== order.id) {
      return NextResponse.json({ error: "Payment session not found." }, { status: 404 });
    }

    await settlePaymentIntent(paymentIntent, order.stripeAccountId);
    const [[current], [party], [pendingApproval]] = await Promise.all([
      db.select({ status: orders.status, holdExpiresAt: orders.holdExpiresAt }).from(orders).where(eq(orders.id, order.id)).limit(1),
      db.select({ value: count() }).from(attendees).where(and(eq(attendees.orderId, order.id), isNull(attendees.deletedAt))),
      db.select({ value: count() }).from(attendees).where(and(eq(attendees.orderId, order.id), eq(attendees.status, "pending_approval"), isNull(attendees.deletedAt))),
    ]);
    const orderStatus = current?.status ?? order.status;
    return NextResponse.json({
      orderId: order.id,
      clientSecret: parsed.data.clientSecret,
      stripeAccountId: order.stripeAccountId,
      partySize: Number(party?.value ?? 1),
      requiresApproval: Number(pendingApproval?.value ?? 0) > 0,
      holdExpiresAt: orderStatus === "pending" ? current?.holdExpiresAt?.toISOString() ?? null : null,
      orderStatus,
      paymentStatus: paymentIntent.status,
      // the seats had already been released when the payment landed; the charge is being returned
      refunded: paymentIntent.status === "succeeded" && orderStatus !== "paid",
    });
  } catch {
    return NextResponse.json({ error: "Payment session could not be verified." }, { status: 400 });
  }
}
