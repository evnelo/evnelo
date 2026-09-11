import { notFound } from "next/navigation";
import { getEvent } from "@evnelo/core/services";
import type { Action } from "@evnelo/core";
import { db } from "@/lib/db";
import { requireOrg, type OrgContext } from "@/lib/auth/session";

/** Event scoped to the current organization, or 404. Used by every event page and action. */
export async function requireEvent(eventId: string, action: Action = "view_events") {
  const ctx = await requireOrg(action, `/dashboard/events/${eventId}`);
  const event = await getEvent(db, eventId);
  if (!event || event.organizationId !== ctx.org.id) notFound();
  return { ...ctx, event } as OrgContext & { event: NonNullable<typeof event> };
}

export const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "muted" | "outline"> = {
  draft: "muted", published: "success", cancelled: "destructive", ended: "outline",
  confirmed: "success", pending_approval: "warning", rejected: "destructive", waitlisted: "outline",
  paid: "success", free: "success", pending: "warning", refunded: "muted", partially_refunded: "warning", failed: "destructive", expired: "muted",
};

export const statusLabel = (s: string) => s.replace(/_/g, " ");
