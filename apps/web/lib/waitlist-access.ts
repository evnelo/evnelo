import { cookies } from "next/headers";
import { getWaitlistOffer, offerIsOpen, type WaitlistEntry } from "@ot/core/services";
import { db } from "@/lib/db";

export const OFFER_COOKIE_MAX_AGE = 2 * 86_400;
export const offerCookieName = (eventId: string) => `ot_wl_${eventId}`;

/** The open waitlist offer this visitor holds for the event (cookie set by /w/{token}), if any. */
export async function waitlistOffer(eventId: string, now = new Date()): Promise<(WaitlistEntry & { ticketTypeId: string; holdExpiresAt: Date }) | null> {
  const token = (await cookies()).get(offerCookieName(eventId))?.value;
  if (!token) return null;
  const entry = await getWaitlistOffer(db, token);
  return entry && entry.eventId === eventId && offerIsOpen(entry, now) ? entry : null;
}
