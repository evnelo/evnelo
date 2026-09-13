import { env } from "./env";
import { stripe } from "./stripe";
import { captureError } from "./observability";

export const stripeConnectConfigured = Boolean(env.EDITION === "cloud" && env.STRIPE_CONNECT_CLIENT_ID && env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY);

/** Read from Stripe so restrictions and revoked access take effect without waiting for a webhook. */
export async function connectedAccountStatus(accountId: string | null): Promise<"missing" | "ready" | "restricted" | "unavailable"> {
  if (!accountId) return "missing";
  try {
    const account = await stripe.accounts.retrieve(accountId);
    return account.charges_enabled ? "ready" : "restricted";
  } catch (error) {
    captureError("stripe.connect.accountStatus", error, { accountId });
    return "unavailable";
  }
}
