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
import { stripe } from "@/lib/stripe";
import OrgInvite, { orgInviteSubject } from "@/emails/org-invite";

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
