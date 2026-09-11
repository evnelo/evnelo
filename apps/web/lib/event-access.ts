import { cookies } from "next/headers";
import { getEventInvite, inviteStatus, listMemberships, type EventInvite } from "@evnelo/core/services";
import type { Event } from "@evnelo/db";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";

export const INVITE_COOKIE_MAX_AGE = 30 * 86_400;
export const inviteCookieName = (eventId: string) => `ev_inv_${eventId}`;

/**
 * Who is looking at an event: a member of its organization (sees everything), someone holding a
 * valid invite cookie for it, or the public. Used by the event page and the order route so the
 * two can never disagree about who may register for a private event.
 */
export async function eventAccess(event: Pick<Event, "id" | "organizationId" | "visibility">): Promise<{ isMember: boolean; invite: EventInvite | null; inviteProblem: "expired" | "exhausted" | null }> {
  const user = await currentUser();
  const isMember = user ? (await listMemberships(db, user.id)).some((m) => m.org.id === event.organizationId) : false;
  if (event.visibility !== "private") return { isMember, invite: null, inviteProblem: null };
  const token = (await cookies()).get(inviteCookieName(event.id))?.value;
  const invite = token ? await getEventInvite(db, token) : null;
  if (!invite || invite.eventId !== event.id) return { isMember, invite: null, inviteProblem: null };
  const status = inviteStatus(invite);
  return { isMember, invite: status === "valid" ? invite : null, inviteProblem: status === "valid" ? null : status };
}
