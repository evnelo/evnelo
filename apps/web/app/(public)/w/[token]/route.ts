import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getWaitlistOffer, offerIsOpen } from "@ot/core/services";
import { events, organizations } from "@ot/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { OFFER_COOKIE_MAX_AGE, offerCookieName } from "@/lib/waitlist-access";
import { publicEventPath } from "@/lib/urls";

export const runtime = "nodejs";

/** Waitlist offer link: remember the offer in a cookie, then show the event with the seat unlocked. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const entry = await getWaitlistOffer(db, token);
  const [row] = entry
    ? await db.select({ eventSlug: events.slug, orgSlug: organizations.slug }).from(events).innerJoin(organizations, eq(organizations.id, events.organizationId)).where(eq(events.id, entry.eventId)).limit(1)
    : [];
  if (!entry || !row || !offerIsOpen(entry)) return NextResponse.redirect(new URL("/w/expired", env.APP_URL));
  const response = NextResponse.redirect(new URL(publicEventPath(row.orgSlug, row.eventSlug), env.APP_URL));
  response.cookies.set(offerCookieName(entry.eventId), entry.token!, { httpOnly: true, sameSite: "lax", secure: env.APP_URL.startsWith("https://"), path: "/", maxAge: OFFER_COOKIE_MAX_AGE });
  return response;
}
