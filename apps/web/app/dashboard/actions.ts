"use server";

import * as React from "react";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import * as svc from "@ot/core/services";
import { ROLE_LABELS, type Role } from "@ot/core";
import { signOut } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ORG_COOKIE, requireOrg } from "@/lib/auth/session";
import { requireEvent } from "@/lib/dashboard";
import { renderEmail, sendEmail } from "@/lib/email";
import { searchAddresses, type AddressSuggestion } from "@/lib/geocoding";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { stripe } from "@/lib/stripe";
import OrgInvite, { orgInviteSubject } from "@/emails/org-invite";
import EventInvite, { eventInviteSubject } from "@/emails/event-invite";
import WaitlistOffer, { waitlistOfferSubject } from "@/emails/waitlist-offer";
import { formatDateRange } from "@/lib/utils";
import { publicEventPath } from "@/lib/urls";
import { calendarPath } from "@/lib/calendar";

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string; issues?: { path: (string | number)[]; message: string }[] };

const fail = (e: unknown): ActionResult => ({ ok: false, error: e instanceof Error ? e.message : "Something went wrong." });
const zodFail = (e: z.ZodError): ActionResult => ({ ok: false, error: e.issues[0] ? `${e.issues[0].path.join(".") || "form"}: ${e.issues[0].message}` : "Check the form.", issues: e.issues.map((i) => ({ path: i.path, message: i.message })) });

/* ---------- session ---------- */

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function switchOrgAction(orgId: string) {
  const { memberships } = await requireOrg();
  if (!memberships.some((m) => m.org.id === orgId)) return;
  (await cookies()).set(ORG_COOKIE, orgId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 365 * 86400 });
  redirect("/dashboard");
}

/* ---------- events ---------- */

export async function saveEventAction(input: unknown, eventId?: string): Promise<ActionResult> {
  const parsed = svc.eventInput.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    if (eventId) {
      await requireEvent(eventId, "edit_events");
      const { changes } = await svc.updateEvent(db, eventId, parsed.data);
      revalidatePath(`/dashboard/events/${eventId}`);
      const notified = changes.schedule || changes.venue ? " Attendees will be told about the new time or place." : "";
      return { ok: true, id: eventId, message: `Saved.${notified}` };
    }
    const ctx = await requireOrg("edit_events");
    const event = await svc.createEvent(db, ctx.org.id, parsed.data);
    return { ok: true, id: event.id };
  } catch (e) {
    return fail(e);
  }
}

export async function publishEventAction(eventId: string) {
  await requireEvent(eventId, "edit_events");
  await svc.publishEvent(db, eventId);
  revalidatePath(`/dashboard/events/${eventId}`);
}
export async function unpublishEventAction(eventId: string) {
  await requireEvent(eventId, "edit_events");
  await svc.unpublishEvent(db, eventId);
  revalidatePath(`/dashboard/events/${eventId}`);
}
export async function cancelEventAction(eventId: string) {
  await requireEvent(eventId, "edit_events");
  await svc.cancelEvent(db, eventId);
  revalidatePath(`/dashboard/events/${eventId}`);
}
export async function deleteEventAction(eventId: string) {
  const { event } = await requireEvent(eventId, "edit_events");
  if (event.status === "published") throw new Error("Unpublish or cancel the event before deleting it.");
  await svc.deleteEvent(db, eventId);
  redirect("/dashboard");
}

export async function searchAddressesAction(query: string): Promise<{ ok: true; data: AddressSuggestion[] } | { ok: false; error: string }> {
  const { user } = await requireOrg("edit_events");
  const normalized = query.trim().slice(0, 160);
  if (normalized.length < 3) return { ok: true, data: [] };
  if (!(await consumeSharedRateLimit("geocode", user.id, 30, 60_000))) return { ok: false, error: "Too many address searches. Wait a minute and try again." };
  try {
    return { ok: true, data: await searchAddresses(normalized, fetch, { provider: env.GEOCODER, photonUrl: env.PHOTON_URL, mapboxToken: env.MAPBOX_TOKEN }) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Address search is temporarily unavailable." };
  }
}

/* ---------- ticket types ---------- */

export async function saveTicketTypeAction(eventId: string, input: unknown, id?: string): Promise<ActionResult> {
  const parsed = svc.ticketTypeInput.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    await requireEvent(eventId, "edit_events");
    const savedId = await svc.upsertTicketType(db, eventId, parsed.data, id);
    revalidatePath(`/dashboard/events/${eventId}/tickets`);
    return { ok: true, id: savedId };
  } catch (e) {
    return fail(e);
  }
}
export async function deleteTicketTypeAction(eventId: string, id: string): Promise<ActionResult> {
  try {
    await requireEvent(eventId, "edit_events");
    await svc.deleteTicketType(db, eventId, id);
    revalidatePath(`/dashboard/events/${eventId}/tickets`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- registration form ---------- */

export async function saveFieldsAction(eventId: string, input: unknown): Promise<ActionResult> {
  const parsed = svc.registrationFieldsInput.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    await requireEvent(eventId, "edit_events");
    await svc.saveRegistrationFields(db, eventId, parsed.data);
    revalidatePath(`/dashboard/events/${eventId}/form`);
    return { ok: true, message: "Form saved." };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- attendees & orders ---------- */

const ids = z.array(z.string().length(26)).min(1);

export async function approveAttendeesAction(eventId: string, formData: FormData) {
  await requireEvent(eventId, "manage_attendees");
  const list = ids.parse(formData.getAll("id"));
  await svc.approveAttendees(db, eventId, list);
  revalidatePath(`/dashboard/events/${eventId}/attendees`);
}
export async function rejectAttendeesAction(eventId: string, formData: FormData) {
  await requireEvent(eventId, "manage_attendees");
  await svc.rejectAttendees(db, eventId, ids.parse(formData.getAll("id")));
  revalidatePath(`/dashboard/events/${eventId}/attendees`);
}
export async function cancelAttendeesAction(eventId: string, formData: FormData) {
  await requireEvent(eventId, "manage_attendees");
  await svc.cancelAttendees(db, eventId, ids.parse(formData.getAll("id")));
  revalidatePath(`/dashboard/events/${eventId}/attendees`);
}

/** Full refund through Stripe; the charge.refunded webhook then cancels the party and returns seats. */
export async function refundOrderAction(eventId: string, orderId: string): Promise<ActionResult> {
  try {
    await requireEvent(eventId, "refund");
    const order = await svc.getOrder(db, eventId, orderId);
    if (!order?.stripePaymentIntentId) return { ok: false, error: "This order has no payment to refund." };
    if (order.status !== "paid" && order.status !== "partially_refunded") return { ok: false, error: `Order is ${order.status}; nothing to refund.` };
    await stripe.refunds.create(
      { payment_intent: order.stripePaymentIntentId },
      env.EDITION === "cloud" && order.stripeAccountId ? { stripeAccount: order.stripeAccountId } : undefined,
    );
    revalidatePath(`/dashboard/events/${eventId}/orders`);
    return { ok: true, message: "Refund requested. The order updates as soon as Stripe confirms it." };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- organization ---------- */

export async function updateOrgAction(input: unknown): Promise<ActionResult> {
  const parsed = svc.organizationInput.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { org } = await requireOrg("manage_org");
    await svc.updateOrganization(db, org.id, parsed.data);
    revalidatePath("/dashboard/settings");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function inviteMemberAction(formData: FormData): Promise<ActionResult> {
  const parsed = z.object({ email: z.string().trim().email(), role: z.enum(["admin", "member", "checkin"]) }).safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { org, user } = await requireOrg("manage_members");
    const invite = await svc.inviteMember(db, { orgId: org.id, ...parsed.data });
    const props = { brand: { orgName: "OpenTicket", appUrl: env.APP_URL }, url: `${env.APP_URL}/invite/${invite.token}`, orgName: org.name, role: ROLE_LABELS[invite.role], invitedBy: user.name ?? user.email };
    try {
      const { html, text } = await renderEmail(React.createElement(OrgInvite, props));
      await sendEmail({ to: invite.email, subject: orgInviteSubject(props), html, text });
    } catch (e) {
      await svc.revokeInvite(db, org.id, invite.id); // no email, no dangling invite
      throw e;
    }
    revalidatePath("/dashboard/settings");
    return { ok: true, message: `Invitation sent to ${invite.email}.` };
  } catch (e) {
    return fail(e);
  }
}
export async function revokeInviteAction(inviteId: string) {
  const { org } = await requireOrg("manage_members");
  await svc.revokeInvite(db, org.id, inviteId);
  revalidatePath("/dashboard/settings");
}
export async function setMemberRoleAction(userId: string, role: Role): Promise<ActionResult> {
  try {
    const { org } = await requireOrg("manage_members");
    await svc.setMemberRole(db, org.id, userId, role);
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
export async function removeMemberAction(userId: string): Promise<ActionResult> {
  try {
    const { org } = await requireOrg("manage_members");
    await svc.removeMember(db, org.id, userId);
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- API keys ---------- */

export async function createApiKeyAction(formData: FormData): Promise<ActionResult & { secret?: string }> {
  const parsed = z.object({ name: z.string().trim().min(1).max(80), scopes: z.array(z.enum(["read", "write"])).min(1) })
    .safeParse({ name: formData.get("name"), scopes: formData.getAll("scopes") });
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { org } = await requireOrg("manage_org");
    const key = await svc.createApiKey(db, { organizationId: org.id, ...parsed.data });
    revalidatePath("/dashboard/settings");
    return { ok: true, id: key.id, secret: key.secret, message: "Key created. Copy it now; it won't be shown again." };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeApiKeyAction(id: string): Promise<ActionResult> {
  try {
    const { org } = await requireOrg("manage_org");
    await svc.revokeApiKey(db, org.id, id);
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- event invitations ---------- */

export async function createEventInviteAction(eventId: string, formData: FormData): Promise<ActionResult & { url?: string }> {
  const parsed = svc.eventInviteInput.safeParse({ email: formData.get("email") ?? "", maxUses: formData.get("maxUses") || undefined, expiresInDays: formData.get("expiresInDays") || null });
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { event, org } = await requireEvent(eventId, "edit_events");
    const invite = await svc.createEventInvite(db, eventId, parsed.data);
    const url = `${env.APP_URL}/i/${invite.token}`;
    if (invite.email) {
      const brand = { orgName: org.name, orgLogoUrl: event.logoUrl ?? org.logoUrl, accent: org.accentColor, appUrl: env.APP_URL };
      const emailEvent = {
        name: event.name, url: `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`, when: formatDateRange(event.startsAt, event.endsAt, event.timezone),
        where: event.locationType === "online" ? "Online" : [event.venueName, event.city].filter(Boolean).join(", "), calendarUrl: `${env.APP_URL}${calendarPath(org.slug, event.slug)}`,
      };
      const expires = invite.expiresAt ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(invite.expiresAt) : null;
      const props = { brand, event: emailEvent, url, expires };
      try {
        const { html, text } = await renderEmail(React.createElement(EventInvite, props));
        await sendEmail({ to: invite.email, subject: eventInviteSubject(props), html, text });
      } catch (e) {
        revalidatePath(`/dashboard/events/${eventId}/invites`);
        return { ok: true, id: invite.id, url, message: `Invite created, but the email could not be sent (${e instanceof Error ? e.message : "unknown error"}). Share the link yourself.` };
      }
    }
    revalidatePath(`/dashboard/events/${eventId}/invites`);
    return { ok: true, id: invite.id, url, message: invite.email ? `Invitation emailed to ${invite.email}.` : "Invite link created." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteEventInviteAction(eventId: string, id: string): Promise<ActionResult> {
  try {
    await requireEvent(eventId, "edit_events");
    await svc.deleteEventInvite(db, eventId, id);
    revalidatePath(`/dashboard/events/${eventId}/invites`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- waitlist ---------- */

export async function promoteWaitlistAction(eventId: string, entryId: string, ticketTypeId: string): Promise<ActionResult> {
  try {
    const { event, org } = await requireEvent(eventId, "manage_attendees");
    const result = await svc.promoteWaitlistEntry(db, eventId, entryId, ticketTypeId);
    if (!result.ok) {
      const why = { not_found: "That entry no longer exists.", already_offered: "This person already has an open offer.", registered: "This person already registered.", no_room: "No seat is free on that ticket type (or the event is at capacity). Free one first." }[result.reason];
      return { ok: false, error: why };
    }
    const entry = result.entry;
    const url = `${env.APP_URL}/w/${entry.token}`;
    const [tt] = await svc.promotableTicketTypes(db, eventId).then((ts) => ts.filter((t) => t.id === ticketTypeId));
    const deadline = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: event.timezone, timeZoneName: "short" }).format(entry.holdExpiresAt!);
    const props = {
      brand: { orgName: org.name, orgLogoUrl: event.logoUrl ?? org.logoUrl, accent: org.accentColor, appUrl: env.APP_URL },
      event: { name: event.name, url: `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`, when: formatDateRange(event.startsAt, event.endsAt, event.timezone), where: event.locationType === "online" ? "Online" : [event.venueName, event.city].filter(Boolean).join(", "), calendarUrl: `${env.APP_URL}${calendarPath(org.slug, event.slug)}` },
      url, ticketTypeName: tt?.name ?? "General admission", deadline,
    };
    revalidatePath(`/dashboard/events/${eventId}/waitlist`);
    try {
      const { html, text } = await renderEmail(React.createElement(WaitlistOffer, props));
      await sendEmail({ to: entry.email, subject: waitlistOfferSubject(props), html, text });
    } catch (e) {
      return { ok: true, message: `Spot reserved until ${deadline}, but the email could not be sent (${e instanceof Error ? e.message : "unknown error"}). Send them this link: ${url}` };
    }
    return { ok: true, message: `Offer emailed to ${entry.email}; the spot is held until ${deadline}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function removeWaitlistEntryAction(eventId: string, entryId: string): Promise<ActionResult> {
  try {
    await requireEvent(eventId, "manage_attendees");
    await svc.removeWaitlistEntry(db, eventId, entryId);
    revalidatePath(`/dashboard/events/${eventId}/waitlist`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
