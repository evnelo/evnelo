import { env } from "./env";
import { stripe } from "./stripe";
import { captureError } from "./observability";

/**
 * Apple Pay only appears in the Payment Element on a domain registered with the Stripe account
 * that processes the charge: each connected account on Cloud, the operator's own account when
 * self-hosted. Registration needs Stripe's verification file, which the app serves from
 * public/.well-known/apple-developer-merchantid-domain-association. Idempotent and best effort:
 * a failure is reported, never surfaced to the host, and Apple Pay simply stays hidden.
 */
export async function ensureApplePayDomain(stripeAccountId: string | null) {
  if (!env.STRIPE_SECRET_KEY) return false;
  const domain = new URL(env.APP_URL).hostname;
  if (!domain.includes(".") || domain.endsWith(".local")) return false; // localhost and the like cannot be verified
  const options = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;
  try {
    const existing = await stripe.applePayDomains.list({ domain_name: domain, limit: 1 }, options);
    if (existing.data.length) return true;
    await stripe.applePayDomains.create({ domain_name: domain }, options);
    return true;
  } catch (error) {
    captureError("stripe.applePayDomain", error, { stripeAccountId, domain });
    return false;
  }
}

const ensured = new Set<string>();

/**
 * The same, once per account per process, from the paid order route: covers accounts that
 * connected before domain registration existed, or whose registration failed at connect time.
 * Fire and forget, so the first checkout after a boot costs one background list call.
 */
export function ensureApplePayDomainOnce(stripeAccountId: string) {
  if (ensured.has(stripeAccountId)) return;
  ensured.add(stripeAccountId);
  void ensureApplePayDomain(stripeAccountId).then((ok) => { if (!ok) ensured.delete(stripeAccountId); });
}
