import type { Edition } from "./edition";
import { SMS_UNLOCK_PRICE_MINOR } from "./fees";

/**
 * SMS gate (PRD §5.2):
 *  - self-hosted: always allowed (organizer brings Vonage keys)
 *  - cloud + paid event: included
 *  - cloud + free event: requires the $5 unlock for that event
 * Plus fair-use: max messages per attendee per event.
 */
export const SMS_FAIR_USE_PER_ATTENDEE = 5;

export type SmsGateInput = {
  edition: Edition;
  eventIsPaid: boolean; // any ticket type with price > 0
  unlocked: boolean; // sms_unlocks row paid for this event
  attendeeMessageCount: number;
  smsConfigured: boolean;
};

export type SmsGateResult =
  | { allowed: true }
  | { allowed: false; reason: "not_configured" | "needs_unlock" | "fair_use_exceeded"; unlockPriceMinor?: number };

export function smsGate(i: SmsGateInput): SmsGateResult {
  if (!i.smsConfigured) return { allowed: false, reason: "not_configured" };
  if (i.attendeeMessageCount >= SMS_FAIR_USE_PER_ATTENDEE) return { allowed: false, reason: "fair_use_exceeded" };
  if (i.edition === "self_hosted") return { allowed: true };
  if (i.eventIsPaid || i.unlocked) return { allowed: true };
  return { allowed: false, reason: "needs_unlock", unlockPriceMinor: SMS_UNLOCK_PRICE_MINOR };
}

/** Countries where a single SMS costs enough that we surcharge/block on the free unlock. */
export const HIGH_COST_SMS_COUNTRIES = new Set(["AF", "BF", "BJ", "CM", "GA", "GN", "ML", "MR", "NE", "SN", "TD", "TG"]);
