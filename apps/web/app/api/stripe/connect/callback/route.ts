import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { can } from "@evnelo/core";
import { connectOrganizationStripe, getMembership } from "@evnelo/core/services";
import { currentUser, ORG_COOKIE } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { stripeConnectConfigured } from "@/lib/stripe-connect";
import { CONNECT_COOKIE, CONNECT_MAX_AGE, verifyConnectState } from "@/lib/stripe-connect-state";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { captureError } from "@/lib/observability";
import { EVENTS } from "@/lib/analytics-events";
import { track } from "@/lib/posthog-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const jar = await cookies();
  const cookie = jar.get(CONNECT_COOKIE)?.value;
  const finish = (result: string, orgId?: string) => {
    const response = NextResponse.redirect(new URL(`/dashboard/settings?tab=payments&connect=${result}`, env.APP_URL));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(CONNECT_COOKIE, "", { path: "/api/stripe/connect/callback", maxAge: 0 });
    if (orgId) response.cookies.set(ORG_COOKIE, orgId, { path: "/", httpOnly: true, sameSite: "lax", secure: new URL(env.APP_URL).protocol === "https:", maxAge: 365 * 86400 });
    return response;
  };
  if (!stripeConnectConfigured) return finish("unconfigured");
  const user = await currentUser();
  if (!user || !cookie) return finish("invalid");
  const params = new URL(req.url).searchParams;
  let context;
  try {
    context = await verifyConnectState(cookie, params.get("state") ?? "", user.id, env.AUTH_SECRET);
  } catch {
    return finish("invalid");
  }
  const role = await getMembership(db, user.id, context.orgId);
  if (!role || !can(role, "manage_org")) return finish("invalid");
  // A database-backed claim also rejects concurrent callbacks before exchanging the one-use code.
  if (!(await consumeSharedRateLimit("stripe:connect:callback", context.state, 1, CONNECT_MAX_AGE * 1000, context.issuedAt))) return finish("invalid");
  if (params.has("error")) return finish(params.get("error") === "access_denied" ? "cancelled" : "failed", context.orgId);
  const code = params.get("code");
  if (!code || code.length > 1024) return finish("invalid", context.orgId);
  try {
    const token = await stripe.oauth.token({ grant_type: "authorization_code", code });
    const live = env.STRIPE_SECRET_KEY?.startsWith("sk_live_") || env.STRIPE_SECRET_KEY?.startsWith("rk_live_");
    if (!token.stripe_user_id || token.scope !== "read_write" || token.livemode !== Boolean(live)) return finish("failed", context.orgId);
    // Prove the platform can access this account before persisting the binding; tokens stay out of storage.
    const account = await stripe.accounts.retrieve(token.stripe_user_id);
    if (!(await connectOrganizationStripe(db, context.orgId, user.id, token.stripe_user_id, account.charges_enabled))) return finish("failed", context.orgId);
    track(EVENTS.stripeConnected, { distinctId: user.id, organizationId: context.orgId, properties: { chargesEnabled: Boolean(account.charges_enabled) } });
    return finish("success", context.orgId);
  } catch {
    // OAuth errors can contain the authorization code or response tokens; never log the raw error.
    captureError("stripe.connect.callback", new Error("Stripe account connection failed."), { organizationId: context.orgId });
    return finish("failed", context.orgId);
  }
}
