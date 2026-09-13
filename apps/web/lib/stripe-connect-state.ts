import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const CONNECT_COOKIE = "ev_stripe_connect";
export const CONNECT_MAX_AGE = 10 * 60;
const audience = "stripe-connect";
const key = (secret: string) => createHash("sha256").update("evnelo:stripe-connect\0").update(secret).digest();

export async function signConnectState(orgId: string, userId: string, secret: string) {
  const state = randomBytes(32).toString("base64url");
  const cookie = await new SignJWT({ orgId, userId, state })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("evnelo").setAudience(audience).setIssuedAt().setExpirationTime(`${CONNECT_MAX_AGE}s`)
    .sign(key(secret));
  return { state, cookie };
}

export async function verifyConnectState(cookie: string, state: string, userId: string, secret: string, now = new Date()) {
  const { payload } = await jwtVerify(cookie, key(secret), { issuer: "evnelo", audience, algorithms: ["HS256"], currentDate: now });
  if (!state || payload.state !== state || payload.userId !== userId || typeof payload.orgId !== "string" || typeof payload.iat !== "number") {
    throw new Error("Invalid Stripe connection state.");
  }
  return { orgId: payload.orgId, userId, state, issuedAt: new Date(payload.iat * 1000) };
}
