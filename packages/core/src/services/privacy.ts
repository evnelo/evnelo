import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  apiKeys, attendees, checkIns, discountCodes, eventInvites, eventReports, events, notifications, orderItems, orders, organizationMembers, organizations,
  registrationFields, ticketTypes, tickets, waitlistEntries, webhooks, type Database,
} from "@ot/db";
import { newId } from "../ids";
import type { DbOrTx } from "./db";

/**
 * Privacy workflows (PRD §7.10, GDPR/LGPD): data-subject export, hard erasure of personal data,
 * organization export and deletion. Erasure keeps the rows that other records point to (an
 * attendee stays an attendee, an order stays an order) but replaces every personal field with a
 * fixed placeholder, so counts, revenue and audit trails survive without the person.
 */

export const ERASED_NAME = "Deleted attendee";
export const erasedEmail = (id: string) => `erased-${id.toLowerCase()}@anonymized.invalid`;

/** Personal data the attendee record carries, in export form. */
export async function exportAttendeeData(db: Database, eventId: string, attendeeId: string) {
  const [attendee] = await db.select().from(attendees).where(and(eq(attendees.id, attendeeId), eq(attendees.eventId, eventId))).limit(1);
  if (!attendee) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, attendee.orderId)).limit(1);
  const [ticketRows, checkInRows, notificationRows, waitlist] = await Promise.all([
    db.select({ id: tickets.id, createdAt: tickets.createdAt, revokedAt: tickets.revokedAt }).from(tickets).where(eq(tickets.attendeeId, attendeeId)),
    db.select({ at: checkIns.createdAt, method: checkIns.method, undoneAt: checkIns.undoneAt }).from(checkIns).innerJoin(tickets, eq(tickets.id, checkIns.ticketId)).where(eq(tickets.attendeeId, attendeeId)),
    db.select({ channel: notifications.channel, template: notifications.template, recipient: notifications.recipient, status: notifications.status, sentAt: notifications.sentAt, createdAt: notifications.createdAt }).from(notifications).where(eq(notifications.attendeeId, attendeeId)),
    db.select().from(waitlistEntries).where(and(eq(waitlistEntries.eventId, eventId), eq(waitlistEntries.email, attendee.email))),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    attendee: { id: attendee.id, name: attendee.name, email: attendee.email, phone: attendee.phone, smsOptIn: attendee.smsOptIn, remindersOptOut: attendee.remindersOptOut, status: attendee.status, answers: attendee.answers, registeredAt: attendee.createdAt },
    order: order ? { id: order.id, status: order.status, email: order.email, currency: order.currency, totalMinor: order.totalMinor, refundedMinor: order.refundedMinor, answers: order.answers, createdAt: order.createdAt, paidAt: order.paidAt } : null,
    tickets: ticketRows, checkIns: checkInRows, notifications: notificationRows, waitlist,
  };
}

export type ErasureSummary = { attendeeId: string; ticketsRevoked: number; notificationsScrubbed: number; orderAnonymized: boolean };

/** Hard-erase one person's data from an event. Irreversible. Seats are not returned (the person attended or chose to leave). */
export async function eraseAttendee(db: Database, eventId: string, attendeeId: string, now = new Date()): Promise<ErasureSummary | null> {
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(attendees).where(and(eq(attendees.id, attendeeId), eq(attendees.eventId, eventId))).for("update");
    if (!a) return null;
    const originalEmail = a.email;
    await tx.update(attendees).set({ name: ERASED_NAME, email: erasedEmail(a.id), phone: null, smsOptIn: false, remindersOptOut: true, answers: {}, deletedAt: now }).where(eq(attendees.id, a.id));
    const revoked = await tx.update(tickets).set({ revokedAt: now }).where(and(eq(tickets.attendeeId, a.id), isNull(tickets.revokedAt)));
    const scrubbed = await tx.update(notifications).set({ recipient: erasedEmail(a.id), data: null, error: null }).where(eq(notifications.attendeeId, a.id));
    await tx.delete(waitlistEntries).where(and(eq(waitlistEntries.eventId, eventId), eq(waitlistEntries.email, originalEmail)));
    // the order's contact email goes once nobody live on the order still uses it
    const [others] = await tx.select({ n: sql<number>`count(*)` }).from(attendees).where(and(eq(attendees.orderId, a.orderId), isNull(attendees.deletedAt), eq(attendees.email, originalEmail)));
    let orderAnonymized = false;
    if (Number(others?.n ?? 0) === 0) {
      const [order] = await tx.select({ email: orders.email }).from(orders).where(eq(orders.id, a.orderId)).limit(1);
      if (order && order.email === originalEmail) { await tx.update(orders).set({ email: erasedEmail(a.orderId), answers: {} }).where(eq(orders.id, a.orderId)); orderAnonymized = true; }
    }
    return { attendeeId: a.id, ticketsRevoked: Number((revoked[0] as { affectedRows?: number }).affectedRows ?? 0), notificationsScrubbed: Number((scrubbed[0] as { affectedRows?: number }).affectedRows ?? 0), orderAnonymized };
  });
}

/** Everything an organization owns, for a takeout. Secrets and key hashes are never included. */
export async function exportOrganizationData(db: Database, orgId: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return null;
  const evs = await db.select().from(events).where(eq(events.organizationId, orgId));
  const eventIds = evs.map((e) => e.id);
  const inEvents = <T extends { eventId: unknown }>(rows: T[]) => rows;
  const [members, types, fields, ords, items, atts, tks, cis, wl, dcs, invs, hooks, keys, reports] = await Promise.all([
    db.select({ userId: organizationMembers.userId, role: organizationMembers.role, since: organizationMembers.createdAt }).from(organizationMembers).where(eq(organizationMembers.organizationId, orgId)),
    eventIds.length ? db.select().from(ticketTypes).where(inArray(ticketTypes.eventId, eventIds)) : [],
    eventIds.length ? db.select().from(registrationFields).where(inArray(registrationFields.eventId, eventIds)) : [],
    db.select().from(orders).where(eq(orders.organizationId, orgId)),
    eventIds.length ? db.select({ item: orderItems }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(eq(orders.organizationId, orgId)).then((r) => r.map((x) => x.item)) : [],
    eventIds.length ? db.select().from(attendees).where(inArray(attendees.eventId, eventIds)) : [],
    eventIds.length ? db.select().from(tickets).where(inArray(tickets.eventId, eventIds)) : [],
    eventIds.length ? db.select().from(checkIns).where(inArray(checkIns.eventId, eventIds)) : [],
    eventIds.length ? db.select().from(waitlistEntries).where(inArray(waitlistEntries.eventId, eventIds)) : [],
    eventIds.length ? db.select().from(discountCodes).where(inArray(discountCodes.eventId, eventIds)) : [],
    eventIds.length ? db.select({ id: eventInvites.id, eventId: eventInvites.eventId, email: eventInvites.email, maxUses: eventInvites.maxUses, uses: eventInvites.uses, expiresAt: eventInvites.expiresAt, createdAt: eventInvites.createdAt }).from(eventInvites).where(inArray(eventInvites.eventId, eventIds)) : [],
    db.select({ id: webhooks.id, url: webhooks.url, events: webhooks.events, active: webhooks.active, createdAt: webhooks.createdAt }).from(webhooks).where(eq(webhooks.organizationId, orgId)),
    db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, scopes: apiKeys.scopes, createdAt: apiKeys.createdAt, revokedAt: apiKeys.revokedAt, lastUsedAt: apiKeys.lastUsedAt }).from(apiKeys).where(eq(apiKeys.organizationId, orgId)),
    eventIds.length ? db.select().from(eventReports).where(inArray(eventReports.eventId, eventIds)) : [],
  ]);
  return {
    exportedAt: new Date().toISOString(), organization: org, members, events: evs, ticketTypes: inEvents(types), registrationFields: inEvents(fields), orders: ords, orderItems: items,
    attendees: atts, tickets: tks.map((t) => ({ ...t, token: undefined })), checkIns: cis, waitlist: wl, discountCodes: dcs, invites: invs, webhooks: hooks, apiKeys: keys, reports,
  };
}

/**
 * Delete an organization: soft-delete it (its pages, keys and webhooks stop working), cancel
 * events without emailing anyone, revoke every ticket and erase every attendee's personal data.
 * Irreversible; the caller must have confirmed with the organization slug.
 */
export async function deleteOrganization(db: Database, orgId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [org] = await tx.select().from(organizations).where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt))).for("update");
    if (!org) return null;
    const evs = await tx.select({ id: events.id }).from(events).where(eq(events.organizationId, orgId));
    const eventIds = evs.map((e) => e.id);
    let erased = 0;
    if (eventIds.length) {
      await tx.update(events).set({ status: "cancelled", deletedAt: now }).where(inArray(events.id, eventIds));
      await tx.update(tickets).set({ revokedAt: now }).where(and(inArray(tickets.eventId, eventIds), isNull(tickets.revokedAt)));
      const people = await tx.select({ id: attendees.id, orderId: attendees.orderId }).from(attendees).where(inArray(attendees.eventId, eventIds));
      for (const p of people) {
        await tx.update(attendees).set({ name: ERASED_NAME, email: erasedEmail(p.id), phone: null, smsOptIn: false, remindersOptOut: true, answers: {}, deletedAt: now }).where(eq(attendees.id, p.id));
        erased++;
      }
      const ords = await tx.select({ id: orders.id }).from(orders).where(eq(orders.organizationId, orgId));
      for (const o of ords) await tx.update(orders).set({ email: erasedEmail(o.id), answers: {} }).where(eq(orders.id, o.id));
      await tx.update(notifications).set({ status: "skipped", recipient: "erased@anonymized.invalid", data: null }).where(and(eq(notifications.organizationId, orgId), inArray(notifications.status, ["queued", "sending"])));
      await tx.update(notifications).set({ recipient: "erased@anonymized.invalid", data: null }).where(eq(notifications.organizationId, orgId));
      await tx.delete(waitlistEntries).where(inArray(waitlistEntries.eventId, eventIds));
      await tx.delete(eventInvites).where(inArray(eventInvites.eventId, eventIds));
    }
    await tx.update(apiKeys).set({ revokedAt: now }).where(and(eq(apiKeys.organizationId, orgId), isNull(apiKeys.revokedAt)));
    await tx.update(webhooks).set({ active: false }).where(eq(webhooks.organizationId, orgId));
    await tx.update(organizations).set({ deletedAt: now, slug: `${org.slug}-deleted-${org.id.slice(-6).toLowerCase()}` }).where(eq(organizations.id, orgId));
    return { events: eventIds.length, attendeesErased: erased };
  });
}

/* ---------- abuse reports ---------- */

export const eventReportInput = z.object({
  eventId: z.string().length(26),
  reason: z.enum(["spam", "scam", "inappropriate", "copyright", "other"]),
  details: z.string().trim().max(2000).optional().or(z.literal("")),
  reporterEmail: z.string().trim().toLowerCase().email().max(255).optional().or(z.literal("")),
});

export async function createEventReport(db: DbOrTx, input: z.infer<typeof eventReportInput>) {
  const id = newId();
  await db.insert(eventReports).values({ id, eventId: input.eventId, reason: input.reason, details: input.details || null, reporterEmail: input.reporterEmail || null });
  return id;
}

export async function listOpenEventReports(db: Database, limit = 100) {
  return db.select({ report: eventReports, event: { id: events.id, name: events.name, slug: events.slug, organizationId: events.organizationId } })
    .from(eventReports).innerJoin(events, eq(events.id, eventReports.eventId)).where(isNull(eventReports.resolvedAt)).orderBy(eventReports.createdAt).limit(limit);
}
