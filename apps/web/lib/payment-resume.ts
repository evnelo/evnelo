import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const issuer = "evnelo";
const audience = "payment-resume";
const key = (secret: string) => createHash("sha256").update("evnelo:payment-resume\0").update(secret).digest();

export function paymentResumeMatches(
  token: { orderId: string; eventId: string },
  order: { id: string; eventId: string; stripePaymentIntentId: string | null },
  clientSecret: string,
) {
  const paymentIntentId = clientSecret.match(/^(pi_[^_]+)_secret_/)?.[1];
  return token.orderId === order.id && token.eventId === order.eventId && paymentIntentId === order.stripePaymentIntentId;
}

export async function signPaymentResume(payload: { orderId: string; eventId: string; expiresAt: Date }, secret: string) {
  return new SignJWT({ orderId: payload.orderId, eventId: payload.eventId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(Math.floor(payload.expiresAt.getTime() / 1000))
    .sign(key(secret));
}

export async function verifyPaymentResume(token: string, secret: string, now = new Date()) {
  const { payload } = await jwtVerify(token, key(secret), { issuer, audience, algorithms: ["HS256"], currentDate: now });
  if (typeof payload.orderId !== "string" || typeof payload.eventId !== "string") throw new Error("Invalid payment resume token.");
  return { orderId: payload.orderId, eventId: payload.eventId };
}
