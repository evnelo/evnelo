"use server";

import * as React from "react";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import * as svc from "@evnelo/core/services";
import { ROLE_LABELS, type Role } from "@evnelo/core";
import { signOut } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ORG_COOKIE, requireOrg } from "@/lib/auth/session";
import { requireEvent } from "@/lib/dashboard";
import { emailLocale, emailTranslator, renderEmail, sendEmail } from "@/lib/email";
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

/** Messages shown in the dashboard come from the `dashboard.actions` keys in the viewer's language. */
const messages = () => getTranslations("dashboard");

const fail = async (e: unknown): Promise<ActionResult> => ({ ok: false, error: e instanceof Error ? e.message : (await messages())("actions.genericError") });
const zodFail = async (e: z.ZodError): Promise<ActionResult> => {
  const t = await messages();
  return {
    ok: false,
    error: e.issues[0] ? t("actions.formIssue", { path: e.issues[0].path.join(".") || t("actions.formPath"), message: e.issues[0].message }) : t("actions.checkForm"),
    issues: e.issues.map((i) => ({ path: i.path, message: i.message })),
  };
};

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
      const t = await messages();
      return { ok: true, id: eventId, message: changes.schedule || changes.venue ? t("actions.savedNotified") : t("actions.saved") };
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
  if (event.status === "published") throw new Error((await messages())("actions.deletePublished"));
  await svc.deleteEvent(db, eventId);
  redirect("/dashboard");
}

export async function searchAddressesAction(query: string): Promise<{ ok: true; data: AddressSuggestion[] } | { ok: false; error: string }> {
  const { user } = await requireOrg("edit_events");
  const normalized = query.trim().slice(0, 160);
  if (normalized.length < 3) return { ok: true, data: [] };
  if (!(await consumeSharedRateLimit("geocode", user.id, 30, 60_000))) return { ok: false, error: (await messages())("actions.addressRateLimited") };
  try {
    return { ok: true, data: await searchAddresses(normalized, fetch, { provider: env.GEOCODER, photonUrl: env.PHOTON_URL, mapboxToken: env.MAPBOX_TOKEN }) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : (await messages())("actions.addressUnavailable") };
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
    return { ok: true, message: (await messages())("actions.formSaved") };
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
    const t = await messages();
    const order = await svc.getOrder(db, eventId, orderId);
    if (!order?.stripePaymentIntentId) return { ok: false, error: t("actions.refund.noPayment") };
    if (order.status !== "paid" && order.status !== "partially_refunded") return { ok: false, error: t("actions.refund.nothingToRefund", { status: t(`status.order.${order.status}`) }) };
    await stripe.refunds.create(
      { payment_intent: order.stripePaymentIntentId },
      env.EDITION === "cloud" && order.stripeAccountId ? { stripeAccount: order.stripeAccountId } : undefined,
    );
    revalidatePath(`/dashboard/events/${eventId}/orders`);
    return { ok: true, message: t("actions.refund.requested") };
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
    return { ok: true, message: (await messages())("actions.saved") };
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
    // the invitee has no stored language yet, so the invitation follows the inviter's
    const i18n = await emailTranslator(emailLocale(await getLocale()));
    const props = { ...i18n, brand: { orgName: "Evnelo", appUrl: env.APP_URL }, url: `${env.APP_URL}/invite/${invite.token}`, orgName: org.name, role: (await messages())(`settings.members.roles.${invite.role}`), invitedBy: user.name ?? user.email };
    try {
      const { html, text } = await renderEmail(React.createElement(OrgInvite, props));
      await sendEmail({ to: invite.email, subject: orgInviteSubject(props), html, text });
    } catch (e) {
      await svc.revokeInvite(db, org.id, invite.id); // no email, no dangling invite
      throw e;
    }
    revalidatePath("/dashboard/settings");
    return { ok: true, message: (await messages())("actions.invitationSent", { email: invite.email }) };
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
    return { ok: true, id: key.id, secret: key.secret, message: (await messages())("actions.apiKeyCreated") };
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
    const t = await messages();
    const invite = await svc.createEventInvite(db, eventId, parsed.data);
    const url = `${env.APP_URL}/i/${invite.token}`;
    if (invite.email) {
      const brand = { orgName: org.name, orgLogoUrl: event.logoUrl ?? org.logoUrl, accent: org.accentColor, appUrl: env.APP_URL };
      const i18n = await emailTranslator(emailLocale(await getLocale())); // invitee unknown: the host's language
      const emailEvent = {
        name: event.name, url: `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`, when: formatDateRange(event.startsAt, event.endsAt, event.timezone, i18n.locale),
        where: event.locationType === "online" ? i18n.t("layout.online") : [event.venueName, event.city].filter(Boolean).join(", "), calendarUrl: `${env.APP_URL}${calendarPath(org.slug, event.slug)}`,
      };
      const expires = invite.expiresAt ? new Intl.DateTimeFormat(i18n.locale, { month: "long", day: "numeric" }).format(invite.expiresAt) : null;
      const props = { ...i18n, brand, event: emailEvent, url, expires };
      try {
        const { html, text } = await renderEmail(React.createElement(EventInvite, props));
        await sendEmail({ to: invite.email, subject: eventInviteSubject(props), html, text });
      } catch (e) {
        revalidatePath(`/dashboard/events/${eventId}/invites`);
        return { ok: true, id: invite.id, url, message: t("actions.eventInvite.emailFailed", { reason: e instanceof Error ? e.message : t("actions.unknownError") }) };
      }
    }
    revalidatePath(`/dashboard/events/${eventId}/invites`);
    return { ok: true, id: invite.id, url, message: invite.email ? t("actions.eventInvite.emailed", { email: invite.email }) : t("actions.eventInvite.linkCreated") };
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
    const [t, locale] = await Promise.all([messages(), getLocale()]);
    const result = await svc.promoteWaitlistEntry(db, eventId, entryId, ticketTypeId);
    if (!result.ok) {
      const why = { not_found: t("actions.waitlist.notFound"), already_offered: t("actions.waitlist.alreadyOffered"), registered: t("actions.waitlist.registered"), no_room: t("actions.waitlist.noRoom") }[result.reason];
      return { ok: false, error: why };
    }
    const entry = result.entry;
    const url = `${env.APP_URL}/w/${entry.token}`;
    const [tt] = await svc.promotableTicketTypes(db, eventId).then((ts) => ts.filter((x) => x.id === ticketTypeId));
    const deadlineFormat = { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: event.timezone, timeZoneName: "short" } as const;
    const i18n = await emailTranslator(emailLocale(entry.locale)); // they joined the waitlist in this language
    const deadline = new Intl.DateTimeFormat(i18n.locale, deadlineFormat).format(entry.holdExpiresAt!);
    // the host reads the confirmation in their own language; the email keeps the attendee-facing format
    const deadlineForHost = new Intl.DateTimeFormat(locale, deadlineFormat).format(entry.holdExpiresAt!);
    const props = {
      ...i18n,
      brand: { orgName: org.name, orgLogoUrl: event.logoUrl ?? org.logoUrl, accent: org.accentColor, appUrl: env.APP_URL },
      event: { name: event.name, url: `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`, when: formatDateRange(event.startsAt, event.endsAt, event.timezone, i18n.locale), where: event.locationType === "online" ? i18n.t("layout.online") : [event.venueName, event.city].filter(Boolean).join(", "), calendarUrl: `${env.APP_URL}${calendarPath(org.slug, event.slug)}` },
      url, ticketTypeName: tt?.name ?? "General admission", deadline,
    };
    revalidatePath(`/dashboard/events/${eventId}/waitlist`);
    try {
      const { html, text } = await renderEmail(React.createElement(WaitlistOffer, props));
      await sendEmail({ to: entry.email, subject: waitlistOfferSubject(props), html, text });
    } catch (e) {
      return { ok: true, message: t("actions.waitlist.emailFailed", { deadline: deadlineForHost, reason: e instanceof Error ? e.message : t("actions.unknownError"), url }) };
    }
    return { ok: true, message: t("actions.waitlist.offered", { email: entry.email, deadline: deadlineForHost }) };
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

/* ---------- discount codes ---------- */

export async function createDiscountCodeAction(eventId: string, input: unknown): Promise<ActionResult> {
  const parsed = svc.discountCodeInput.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    await requireEvent(eventId, "edit_events");
    const row = await svc.createDiscountCode(db, eventId, parsed.data);
    revalidatePath(`/dashboard/events/${eventId}/tickets`);
    return { ok: true, id: row.id, message: (await messages())("actions.discountCreated", { code: row.code }) };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDiscountCodeAction(eventId: string, id: string): Promise<ActionResult> {
  try {
    await requireEvent(eventId, "edit_events");
    await svc.deleteDiscountCode(db, eventId, id);
    revalidatePath(`/dashboard/events/${eventId}/tickets`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- outbound webhooks ---------- */

export async function createWebhookAction(input: unknown): Promise<ActionResult & { secret?: string }> {
  const parsed = svc.webhookInput.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { org } = await requireOrg("manage_org");
    const row = await svc.createWebhook(db, org.id, parsed.data);
    revalidatePath("/dashboard/settings");
    return { ok: true, id: row.id, secret: row.secret, message: (await messages())("actions.webhook.created") };
  } catch (e) {
    return fail(e);
  }
}

export async function updateWebhookAction(id: string, input: unknown): Promise<ActionResult> {
  const parsed = svc.webhookInput.partial().safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const { org } = await requireOrg("manage_org");
    const row = await svc.updateWebhook(db, org.id, id, parsed.data);
    revalidatePath("/dashboard/settings");
    return row ? { ok: true } : { ok: false, error: (await messages())("actions.webhook.notFound") };
  } catch (e) {
    return fail(e);
  }
}

export async function rotateWebhookSecretAction(id: string): Promise<ActionResult & { secret?: string }> {
  try {
    const { org } = await requireOrg("manage_org");
    const t = await messages();
    const secret = await svc.rotateWebhookSecret(db, org.id, id);
    return secret ? { ok: true, secret, message: t("actions.webhook.rotated") } : { ok: false, error: t("actions.webhook.notFound") };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteWebhookAction(id: string): Promise<ActionResult> {
  try {
    const { org } = await requireOrg("manage_org");
    await svc.deleteWebhook(db, org.id, id);
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Queue a synthetic `event.updated`-shaped ping so people can check their receiver end to end. */
export async function testWebhookAction(id: string): Promise<ActionResult> {
  try {
    const { org } = await requireOrg("manage_org");
    const t = await messages();
    const hook = await svc.getWebhook(db, org.id, id);
    if (!hook) return { ok: false, error: t("actions.webhook.notFound") };
    const { webhookDeliveries } = await import("@evnelo/db");
    const { newId } = await import("@evnelo/core");
    const now = new Date();
    await db.insert(webhookDeliveries).values({ id: newId(), webhookId: hook.id, event: "test.ping", payload: { id: newId(), type: "test.ping", createdAt: now.toISOString(), organizationId: org.id, data: { message: "Hello from Evnelo. Your receiver works." } }, nextAttemptAt: now });
    return { ok: true, message: t("actions.webhook.testQueued") };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- privacy ---------- */

export async function eraseAttendeeAction(eventId: string, formData: FormData) {
  const attendeeId = String(formData.get("id") ?? "");
  await requireEvent(eventId, "manage_attendees");
  await svc.eraseAttendee(db, eventId, attendeeId);
  revalidatePath(`/dashboard/events/${eventId}/attendees`);
}

export async function deleteOrganizationAction(formData: FormData): Promise<ActionResult> {
  try {
    const { org, role } = await requireOrg("manage_org");
    const t = await messages();
    if (role !== "owner") return { ok: false, error: t("actions.deleteOrg.ownerOnly") };
    if (String(formData.get("confirm") ?? "").trim() !== org.slug) return { ok: false, error: t("actions.deleteOrg.confirmSlug", { slug: org.slug }) };
    await svc.deleteOrganization(db, org.id);
  } catch (e) {
    return fail(e);
  }
  (await cookies()).delete(ORG_COOKIE);
  redirect("/dashboard");
}
