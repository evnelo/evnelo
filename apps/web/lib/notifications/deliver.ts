import * as React from "react";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { attendees, events, notifications, orders, organizations, smsUnlocks, ticketTypes, tickets, type Notification } from "@evnelo/db";
import { currentEdition, smsGate } from "@evnelo/core";
import { db } from "@/lib/db";
import { appleWalletConfigured, env, googleWalletConfigured, smsConfigured } from "@/lib/env";
import { emailLocale, emailTranslator, renderEmail, sendEmail } from "@/lib/email";
import { sms, smsTemplates } from "@/lib/sms";
import { formatDateRange, formatMoney } from "@/lib/utils";
import { publicEventPath } from "@/lib/urls";
import { calendarPath } from "@/lib/calendar";
import { unsubscribeUrl } from "./unsubscribe";
import type { EmailBrand, EmailEvent, EmailTicket, EmailTranslator } from "@/emails/layout";
import RegistrationConfirmation, { registrationConfirmationSubject } from "@/emails/registration-confirmation";
import ApprovalPending, { approvalPendingSubject } from "@/emails/approval-pending";
import RefundIssued, { refundIssuedSubject } from "@/emails/refund-issued";
import EventReminder, { eventReminderSubject } from "@/emails/event-reminder";
import RegistrationRejected, { registrationRejectedSubject } from "@/emails/registration-rejected";
import EventUpdated, { eventUpdatedSubject } from "@/emails/event-updated";
import EventCancelled, { eventCancelledSubject } from "@/emails/event-cancelled";

export type DeliveryResult = { providerMessageId: string } | { skipped: true; reason: string };

/**
 * "tomorrow", "in 2 days", "in 1 hour": the same buckets as `reminderWhen` in @evnelo/core,
 * translated (emails.reminderWhen.*) instead of hard-coded English.
 */
export function reminderPhrase(t: EmailTranslator, hours: number): string {
  if (hours >= 20 && hours <= 28) return t("reminderWhen.tomorrow");
  if (hours >= 24) return t("reminderWhen.days", { count: Math.round(hours / 24) });
  return t("reminderWhen.hours", { count: hours });
}

/** Everything a template needs, loaded once per notification. */
async function loadContext(n: Notification) {
  if (!n.attendeeId) throw new Error("notification has no attendee");
  const [row] = await db
    .select({ attendee: attendees, event: events, org: organizations, order: orders })
    .from(attendees)
    .innerJoin(events, eq(attendees.eventId, events.id))
    .innerJoin(organizations, eq(events.organizationId, organizations.id))
    .innerJoin(orders, eq(attendees.orderId, orders.id))
    .where(eq(attendees.id, n.attendeeId))
    .limit(1);
  if (!row) throw new Error("attendee not found");
  const { attendee, event, org, order } = row;

  // every live ticket in the order that belongs to this email (host + guests without their own address)
  const party = await db
    .select({ attendee: attendees, ticket: tickets, ticketTypeName: ticketTypes.name })
    .from(attendees)
    .innerJoin(tickets, and(eq(tickets.attendeeId, attendees.id), isNull(tickets.revokedAt)))
    .innerJoin(ticketTypes, eq(attendees.ticketTypeId, ticketTypes.id))
    .where(and(eq(attendees.orderId, order.id), eq(attendees.email, attendee.email), isNull(attendees.deletedAt)));
  const hostNames = new Map(party.filter((p) => !p.attendee.guestOfAttendeeId).map((p) => [p.attendee.id, p.attendee.name]));

  // the language the attendee registered in (null on old rows: English)
  const i18n = await emailTranslator(emailLocale(attendee.locale));
  const { locale, t } = i18n;
  const brand: EmailBrand = { orgName: org.name, orgLogoUrl: event.logoUrl ?? org.logoUrl, accent: org.accentColor, appUrl: env.APP_URL };
  const eventUrl = `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`;
  const emailEvent: EmailEvent = {
    name: event.name, url: eventUrl, when: formatDateRange(event.startsAt, event.endsAt, event.timezone, locale),
    where: event.locationType === "online" ? t("layout.online") : [event.venueName, event.address, event.city].filter(Boolean).join(", "),
    onlineUrl: event.locationType !== "in_person" && attendee.status === "confirmed" ? event.onlineUrl : null,
    calendarUrl: `${env.APP_URL}${calendarPath(org.slug, event.slug)}`,
  };
  const emailTickets: EmailTicket[] = party
    .sort((a, b) => (a.attendee.guestOfAttendeeId ? 1 : 0) - (b.attendee.guestOfAttendeeId ? 1 : 0))
    .map((p) => ({
      attendeeName: p.attendee.name, ticketTypeName: p.ticketTypeName,
      url: `${env.APP_URL}/t/${p.ticket.token}`, qrUrl: `${env.APP_URL}/t/${p.ticket.token}/qr?format=png`,
      guestOf: p.attendee.guestOfAttendeeId ? hostNames.get(p.attendee.guestOfAttendeeId) ?? null : null,
    }));
  const first = party[0]?.ticket;
  const wallet = first
    ? { apple: appleWalletConfigured ? `${env.APP_URL}/t/${first.token}/wallet/apple` : undefined, google: googleWalletConfigured ? `${env.APP_URL}/t/${first.token}/wallet/google` : undefined }
    : null;
  return { attendee, event, org, order, party, brand, emailEvent, emailTickets, wallet, i18n, locale, t };
}

async function deliverEmail(n: Notification): Promise<DeliveryResult> {
  const ctx = await loadContext(n);
  const { attendee, event, order, brand, emailEvent, emailTickets, wallet, i18n, locale, t } = ctx;
  let element: React.ReactElement;
  let subject: string;
  switch (n.template) {
    case "registration_confirmation": {
      if (!emailTickets.length) return { skipped: true, reason: "no live tickets for this email" };
      const props = { ...i18n, brand, event: emailEvent, tickets: emailTickets, wallet };
      element = React.createElement(RegistrationConfirmation, props); subject = registrationConfirmationSubject(props); break;
    }
    case "approval_pending": {
      const [c] = await db.select({ count: sql<number>`count(*)` }).from(attendees).where(eq(attendees.orderId, order.id));
      const props = { ...i18n, brand, event: emailEvent, attendeeName: attendee.name, partySize: Number(c?.count ?? 1) };
      element = React.createElement(ApprovalPending, props); subject = approvalPendingSubject(props); break;
    }
    case "refund_issued": {
      const [c] = await db.select({ count: sql<number>`count(*)` }).from(attendees).where(eq(attendees.orderId, order.id));
      const props = { ...i18n, brand, event: emailEvent, attendeeName: attendee.name, amount: formatMoney(order.refundedMinor, order.currency, locale), ticketCount: Number(c?.count ?? 1) };
      element = React.createElement(RefundIssued, props); subject = refundIssuedSubject(props); break;
    }
    case "reminder": {
      if (!emailTickets.length) return { skipped: true, reason: "no live tickets for this email" };
      if (attendee.remindersOptOut) return { skipped: true, reason: "attendee opted out of reminders" };
      if (event.status !== "published") return { skipped: true, reason: `event is ${event.status}` };
      const hours = Number((n.data as { hours?: number } | null)?.hours ?? 24);
      const props = { ...i18n, brand, event: emailEvent, when: reminderPhrase(t, hours), tickets: emailTickets, unsubscribeUrl: unsubscribeUrl(attendee.id) };
      element = React.createElement(EventReminder, props); subject = eventReminderSubject(props); break;
    }
    case "registration_rejected": {
      const props = { ...i18n, brand, event: emailEvent, attendeeName: attendee.name, paid: order.status === "paid" || order.status === "partially_refunded" };
      element = React.createElement(RegistrationRejected, props); subject = registrationRejectedSubject(props); break;
    }
    case "event_updated": {
      const changes = ((n.data as { changes?: { schedule: boolean; venue: boolean } } | null)?.changes) ?? { schedule: true, venue: true };
      const props = { ...i18n, brand, event: emailEvent, attendeeName: attendee.name, changes };
      element = React.createElement(EventUpdated, props); subject = eventUpdatedSubject(props); break;
    }
    case "event_cancelled": {
      const props = { ...i18n, brand, event: emailEvent, attendeeName: attendee.name, paid: order.status === "paid" || order.status === "partially_refunded" };
      element = React.createElement(EventCancelled, props); subject = eventCancelledSubject(props); break;
    }
    default:
      return { skipped: true, reason: `unknown email template ${n.template}` };
  }
  const { html, text } = await renderEmail(element);
  return sendEmail({ to: n.recipient, subject, html, text });
}

async function deliverSms(n: Notification): Promise<DeliveryResult> {
  const ctx = await loadContext(n);
  const { attendee, event, org, party, t } = ctx;
  if (!attendee.smsOptIn || !attendee.phone) return { skipped: true, reason: "attendee has not opted in to SMS" };

  // the gate: edition rules, the $5 unlock on cloud free events, fair use per attendee
  const [[paid], [unlock], [sent]] = await Promise.all([
    db.select({ id: ticketTypes.id }).from(ticketTypes).where(and(eq(ticketTypes.eventId, event.id), sql`${ticketTypes.priceMinor} > 0`)).limit(1),
    db.select({ id: smsUnlocks.id }).from(smsUnlocks).where(and(eq(smsUnlocks.eventId, event.id), sql`${smsUnlocks.paidAt} is not null`)).limit(1),
    db.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.attendeeId, attendee.id), eq(notifications.channel, "sms"), inArray(notifications.status, ["sent", "delivered"]))),
  ]);
  const gate = smsGate({ edition: currentEdition(), eventIsPaid: !!paid, unlocked: !!unlock, attendeeMessageCount: Number(sent?.count ?? 0), smsConfigured });
  if (!gate.allowed) return { skipped: true, reason: gate.reason };

  const ticket = party.find((p) => p.attendee.id === attendee.id)?.ticket ?? party[0]?.ticket;
  const eventUrl = `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`;
  let text: string;
  if (n.template === "updated") text = smsTemplates.updated(t, { event: event.name, url: eventUrl });
  else if (n.template === "cancelled") text = smsTemplates.cancelled(t, { event: event.name });
  else {
  if (!ticket) return { skipped: true, reason: "no live ticket" };
  const ticketUrl = `${env.APP_URL}/t/${ticket.token}`;
  switch (n.template) {
    case "confirmation": text = smsTemplates.confirmation(t, { event: event.name, ticketUrl }); break;
    case "reminder": {
      if (attendee.remindersOptOut) return { skipped: true, reason: "attendee opted out of reminders" };
      if (event.status !== "published") return { skipped: true, reason: `event is ${event.status}` };
      const hours = Number((n.data as { hours?: number } | null)?.hours ?? 24);
      text = smsTemplates.reminder(t, { event: event.name, when: reminderPhrase(t, hours), ticketUrl }); break;
    }
    default: return { skipped: true, reason: `unknown sms template ${n.template}` };
  }
  }
  return sms!.send(attendee.phone, text);
}

export async function deliver(n: Notification): Promise<DeliveryResult> {
  return n.channel === "email" ? deliverEmail(n) : deliverSms(n);
}
