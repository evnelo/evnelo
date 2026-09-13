import Stripe from "stripe";
import { env } from "./env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "sk_missing", { apiVersion: "2025-02-24.acacia" });

/**
 * Create the PaymentIntent for an order.
 * - Cloud + organizer connected via Stripe Connect Standard: charge on the organizer's
 *   account (stripeAccount header) and take 0.99% as application_fee_amount.
 * - Cloud without a connected account: refuse payment (never charge on the platform).
 * - Self-hosted: charge on the organizer's own keys, no application fee.
 */
export async function createOrderPaymentIntent(args: {
  orderId: string;
  amountMinor: number;
  currency: string;
  platformFeeMinor: number;
  stripeAccountId?: string | null;
  receiptEmail: string;
}) {
  if (env.EDITION === "cloud" && !args.stripeAccountId) throw new Error("A connected Stripe account is required.");
  const onConnectedAccount = env.EDITION === "cloud" && !!args.stripeAccountId;
  return stripe.paymentIntents.create(
    {
      amount: args.amountMinor,
      currency: args.currency.toLowerCase(),
      receipt_email: args.receiptEmail,
      automatic_payment_methods: { enabled: true },
      metadata: { orderId: args.orderId },
      ...(onConnectedAccount && args.platformFeeMinor > 0 ? { application_fee_amount: args.platformFeeMinor } : {}),
    },
    {
      idempotencyKey: `order:${args.orderId}`,
      ...(onConnectedAccount ? { stripeAccount: args.stripeAccountId! } : {}),
    },
  );
}

/** OAuth URL for "Connect your Stripe account" (Connect Standard). Cloud only. */
export function connectOnboardingUrl(state: string) {
  if (env.EDITION !== "cloud" || !env.STRIPE_CONNECT_CLIENT_ID) throw new Error("Stripe Connect is not configured.");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.STRIPE_CONNECT_CLIENT_ID ?? "",
    scope: "read_write",
    state,
    redirect_uri: new URL("/api/stripe/connect/callback", env.APP_URL).href,
  });
  return `https://connect.stripe.com/oauth/authorize?${params}`;
}
