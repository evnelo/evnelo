import type Stripe from "stripe";
import { stripe } from "./stripe";

/** Platform and connected-account destinations have separate signing secrets, even at one URL. */
export function verifyStripeWebhook(body: string, signature: string, secrets: (string | undefined)[]): Stripe.Event {
  for (const secret of new Set(secrets.filter((value): value is string => Boolean(value)))) {
    try { return stripe.webhooks.constructEvent(body, signature, secret); } catch { /* try the other destination */ }
  }
  throw new Error("Invalid Stripe webhook signature.");
}
