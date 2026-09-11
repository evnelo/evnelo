/**
 * Notification rules shared by the worker and the webhooks.
 * Sending itself lives in apps/web/lib/notifications; this file is pure.
 */

export const NOTIFICATION_RETRY_LIMIT = 5;

/** Backoff before retrying a failed send: 2, 4, 8, 16, 32 minutes. */
export function retryDelayMs(attempt: number): number {
  return Math.min(2 ** Math.max(attempt, 1), 60) * 60_000;
}

/** Rows claimed by a worker that died are given back after this long. */
export const STUCK_SENDING_MS = 10 * 60_000;

export type ReminderSlot = { hours: number; at: Date };

/**
 * When each reminder for an event should go out. Slots already in the past (beyond a
 * short grace period) are dropped so a late scheduler never floods attendees.
 */
export function reminderSlots(startsAt: Date, hours: number[], now: Date, graceMs = 5 * 60_000): ReminderSlot[] {
  return [...new Set(hours)]
    .filter((h) => Number.isFinite(h) && h > 0)
    .map((h) => ({ hours: h, at: new Date(startsAt.getTime() - h * 3_600_000) }))
    .filter((s) => s.at.getTime() >= now.getTime() - graceMs && s.at < startsAt)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function reminderDedupeKey(attendeeId: string, hours: number, channel: "email" | "sms") {
  return `reminder:${attendeeId}:${hours}:${channel}`;
}

/** Human label for a reminder, e.g. "tomorrow" or "in 1 hour". */
export function reminderWhen(hours: number): string {
  if (hours >= 20 && hours <= 28) return "tomorrow";
  if (hours >= 24) return `in ${Math.round(hours / 24)} days`;
  return hours === 1 ? "in 1 hour" : `in ${hours} hours`;
}

/** Carrier-mandated opt-out keywords, plus Portuguese for Brazil. */
const STOP = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "PARAR", "SAIR"]);
const START = new Set(["START", "UNSTOP", "YES", "VOLTAR"]);

export function smsKeyword(text: string): "stop" | "start" | null {
  const word = text.trim().toUpperCase().split(/\s+/)[0] ?? "";
  if (STOP.has(word)) return "stop";
  if (START.has(word)) return "start";
  return null;
}
