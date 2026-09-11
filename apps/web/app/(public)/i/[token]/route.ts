import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getEventInvite, inviteStatus } from "@evnelo/core/services";
import { events, organizations } from "@evnelo/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { INVITE_COOKIE_MAX_AGE, inviteCookieName } from "@/lib/event-access";
import { publicEventPath } from "@/lib/urls";

export const runtime = "nodejs";

/** Invitation link: remember the invite for this event in a cookie, then show the event. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getEventInvite(db, token);
  const [row] = invite
    ? await db.select({ eventSlug: events.slug, orgSlug: organizations.slug, status: events.status }).from(events).innerJoin(organizations, eq(organizations.id, events.organizationId)).where(eq(events.id, invite.eventId)).limit(1)
    : [];
  if (!invite || !row || row.status === "draft" || inviteStatus(invite) !== "valid") {
    return NextResponse.redirect(new URL("/i/expired", env.APP_URL));
  }
  const response = NextResponse.redirect(new URL(publicEventPath(row.orgSlug, row.eventSlug), env.APP_URL));
  response.cookies.set(inviteCookieName(invite.eventId), invite.token, { httpOnly: true, sameSite: "lax", secure: env.APP_URL.startsWith("https://"), path: "/", maxAge: INVITE_COOKIE_MAX_AGE });
  return response;
}
