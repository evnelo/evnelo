import type { Organization } from "@ot/db";
import {
  inviteStatus, waitlistStatus, webhookDeliveryState,
  type AttendeeView, type EventInvite, type WaitlistEntry, type Webhook, type WebhookDelivery,
} from "@ot/core/services";
import { env } from "@/lib/env";

/**
 * REST response shapes. Dates serialize to ISO strings through JSON; these functions decide what
 * leaves the process: never a hashed or signing secret, tokens only where the dashboard shows them
 * (ticket links on attendees, invite links), and the derived states the dashboard computes.
 */

export const ticketUrl = (token: string) => `${env.APP_URL}/t/${token}`;
export const inviteUrl = (token: string) => `${env.APP_URL}/i/${token}`;
export const waitlistOfferUrl = (token: string) => `${env.APP_URL}/w/${token}`;

export function serializeOrganization(org: Organization) {
  const { stripeAccountId: _account, stripeAccountType: _type, deletedAt: _deleted, ...rest } = org;
  return rest;
}

export function serializeAttendee(view: AttendeeView) {
  const { attendee, ticketId, ticketToken, ticketRevokedAt, checkedInAt, ticketTypeName, hostName, orderStatus, orderTotalMinor, orderCurrency } = view;
  return {
    ...attendee,
    ticketTypeName,
    hostName,
    order: { id: attendee.orderId, status: orderStatus, totalMinor: orderTotalMinor, currency: orderCurrency },
    ticket: ticketId && ticketToken ? { id: ticketId, token: ticketToken, url: ticketUrl(ticketToken), revokedAt: ticketRevokedAt, checkedInAt } : null,
  };
}

export function serializeWebhook(webhook: Webhook) {
  const { secret: _secret, ...rest } = webhook;
  return rest;
}

export function serializeWebhookDelivery(delivery: WebhookDelivery) {
  return { ...delivery, state: webhookDeliveryState(delivery) };
}

export function serializeInvite(invite: EventInvite) {
  return { ...invite, url: inviteUrl(invite.token), status: inviteStatus(invite) };
}

/** The claim token stays private: the promote response is the one place the offer link is returned. */
export function serializeWaitlistEntry(row: { entry: WaitlistEntry; ticketTypeName: string | null }) {
  const { token: _token, ...entry } = row.entry;
  return { ...entry, ticketTypeName: row.ticketTypeName, status: waitlistStatus(row.entry) };
}
