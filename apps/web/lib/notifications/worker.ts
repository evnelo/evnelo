import { captureError } from "@/lib/observability";
import { and, asc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { attendees, events, notifications, tickets } from "@ot/db";
import { NOTIFICATION_RETRY_LIMIT, STUCK_SENDING_MS, newId, reminderDedupeKey, reminderSlots, retryDelayMs } from "@ot/core";
import { db } from "@/lib/db";
import { deliver } from "./deliver";
import { expireHolds, reconcileProcessingOrders } from "@/lib/orders";
import { purgeApiHousekeeping } from "@ot/core/services";

/**
 * The job runner. No Redis: everything is rows in `notifications`, claimed with a
 * conditional UPDATE so several workers (or a crashed one that restarted) never double-send.
 */

/** Rows a worker claimed but never finished (crash, deploy) go back to the queue. */
export async function requeueStuck() {
  const [r] = await db.update(notifications)
    .set({ status: "queued" })
    .where(and(eq(notifications.status, "sending"), lt(notifications.scheduledFor, new Date(Date.now() - STUCK_SENDING_MS))));
  return r.affectedRows;
}

/**
 * Enqueue reminders for events starting within the next 8 days, one row per attendee, per
 * configured hour, per channel. Idempotent via dedupeKey; if the event moves, queued rows move too.
 */
export async function scheduleReminders() {
  const now = new Date();
  const upcoming = await db.select().from(events).where(and(
    eq(events.status, "published"), isNull(events.deletedAt),
    gte(events.startsAt, now), lte(events.startsAt, new Date(now.getTime() + 8 * 24 * 3_600_000)),
  ));
  let scheduled = 0;
  for (const event of upcoming) {
    const slots = reminderSlots(event.startsAt, event.reminderHours, now);
    if (!slots.length) continue;
    const party = await db
      .select({ a: attendees })
      .from(attendees)
      .innerJoin(tickets, and(eq(tickets.attendeeId, attendees.id), isNull(tickets.revokedAt)))
      .where(and(eq(attendees.eventId, event.id), eq(attendees.status, "confirmed"), isNull(attendees.deletedAt), eq(attendees.remindersOptOut, false)));
    // one email per address: guests riding on the host's email are covered by the host's reminder
    const hostEmails = new Set(party.filter((p) => !p.a.guestOfAttendeeId).map((p) => p.a.email));
    for (const { a } of party) {
      const emailCovered = !!a.guestOfAttendeeId && hostEmails.has(a.email);
      for (const slot of slots) {
        const rows = [
          ...(emailCovered ? [] : [{ channel: "email" as const, recipient: a.email }]),
          ...(a.phone && a.smsOptIn ? [{ channel: "sms" as const, recipient: a.phone }] : []),
        ];
        for (const r of rows) {
          await db.insert(notifications)
            .values({
              id: newId(), organizationId: event.organizationId, eventId: event.id, attendeeId: a.id,
              channel: r.channel, template: "reminder", recipient: r.recipient, scheduledFor: slot.at,
              data: { hours: slot.hours }, dedupeKey: reminderDedupeKey(a.id, slot.hours, r.channel),
            })
            .onDuplicateKeyUpdate({ set: { scheduledFor: sql`IF(${notifications.status} = 'queued', ${slot.at}, ${notifications.scheduledFor})` } });
          scheduled++;
        }
      }
    }
  }
  return scheduled;
}

export async function processNotifications(limit = 50) {
  const now = new Date();
  const due = await db.select({ id: notifications.id }).from(notifications)
    .where(and(eq(notifications.status, "queued"), lte(notifications.scheduledFor, now)))
    .orderBy(asc(notifications.scheduledFor))
    .limit(limit);
  const stats = { sent: 0, skipped: 0, failed: 0, retried: 0 };
  for (const { id } of due) {
    // claim; scheduledFor doubles as the claim time so requeueStuck can find abandoned rows
    const [claim] = await db.update(notifications)
      .set({ status: "sending", scheduledFor: new Date(), attempts: sql`${notifications.attempts} + 1` })
      .where(and(eq(notifications.id, id), eq(notifications.status, "queued")));
    if (claim.affectedRows === 0) continue;
    const [n] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    if (!n) continue;
    try {
      const result = await deliver(n);
      if ("skipped" in result) {
        stats.skipped++;
        await db.update(notifications).set({ status: "skipped", error: result.reason }).where(eq(notifications.id, id));
      } else {
        stats.sent++;
        await db.update(notifications).set({ status: "sent", sentAt: new Date(), providerMessageId: result.providerMessageId, error: null }).where(eq(notifications.id, id));
      }
    } catch (e) {
      const error = String((e as Error).message ?? e).slice(0, 300);
      if (n.attempts >= NOTIFICATION_RETRY_LIMIT) {
        stats.failed++;
        await db.update(notifications).set({ status: "failed", error }).where(eq(notifications.id, id));
      } else {
        stats.retried++;
        await db.update(notifications).set({ status: "queued", scheduledFor: new Date(Date.now() + retryDelayMs(n.attempts)), error }).where(eq(notifications.id, id));
      }
      // retries are expected (provider hiccups); only a notification we give up on is an incident
      if (n.attempts >= NOTIFICATION_RETRY_LIMIT) captureError("notifications.failed", e, { notificationId: n.id, channel: n.channel, template: n.template, attempts: n.attempts });
      else console.warn(`[notifications] ${n.channel}/${n.template} ${n.id} attempt ${n.attempts} failed, will retry: ${error}`);
    }
  }
  return stats;
}

const SCHEDULE_EVERY_MS = 60_000;
let lastScheduled = 0;

/** One pass of everything. Safe to call from a timer, a cron hit, or a test. Reminder scheduling runs at most once a minute. */
export async function runJobs(opts: { force?: boolean } = {}) {
  // lapsed checkout holds: cancel the PaymentIntent at Stripe, then give the seats back
  const expiredHolds = await expireHolds().catch((e) => { captureError("jobs.expireHolds", e); return 0; });
  const requeued = await requeueStuck();
  let scheduled = 0;
  let reconciled = 0;
  if (opts.force || Date.now() - lastScheduled >= SCHEDULE_EVERY_MS) {
    scheduled = await scheduleReminders();
    reconciled = await reconcileProcessingOrders().catch((e) => { captureError("jobs.reconcileProcessingOrders", e); return 0; });
    await purgeApiHousekeeping(db).catch((e) => captureError("jobs.purgeApiHousekeeping", e));
    lastScheduled = Date.now();
  }
  const processed = await processNotifications();
  return { expiredHolds, reconciled, requeued, scheduled, ...processed };
}
