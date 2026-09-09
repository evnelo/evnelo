import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Signed, non-expiring link that lets an attendee stop reminders without logging in. */
function sign(attendeeId: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(`unsubscribe:${attendeeId}`).digest("base64url").slice(0, 32);
}
export function unsubscribeToken(attendeeId: string) {
  return `${attendeeId}.${sign(attendeeId)}`;
}
export function unsubscribeUrl(attendeeId: string) {
  return `${env.APP_URL}/unsubscribe/${unsubscribeToken(attendeeId)}`;
}
export function verifyUnsubscribeToken(token: string): string | null {
  const [id, sig] = token.split(".");
  if (!id || !sig || id.length !== 26) return null;
  const expected = sign(id);
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? id : null;
}
