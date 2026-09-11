import { can } from "@ot/core";
import { getEvent, listMemberships } from "@ot/core/services";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";

/**
 * Door staff access to one event: signed in, member of the event's organization with the
 * check_in permission. Independent of the org cookie so staff who belong to several
 * organizations can open any scanner link they were given.
 */
export async function checkInAccess(eventId: string) {
  const user = await currentUser();
  if (!user) return { ok: false as const, status: 401 as const, error: "Sign in to check people in." };
  const event = await getEvent(db, eventId);
  if (!event) return { ok: false as const, status: 404 as const, error: "Event not found." };
  const membership = (await listMemberships(db, user.id)).find((m) => m.org.id === event.organizationId);
  if (!membership || !can(membership.role, "check_in")) return { ok: false as const, status: 403 as const, error: "You don't have check-in access to this event." };
  return { ok: true as const, user, event, org: membership.org, role: membership.role };
}
