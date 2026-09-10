import { NextResponse } from "next/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { events, organizations } from "@ot/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { buildIcs } from "@/lib/ics";
import { publicEventPath } from "@/lib/urls";

export const runtime = "nodejs";

/** GET /api/calendar/{slug}.ics for public and unlisted events. Public info only: the online link stays behind the ticket. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!file.endsWith(".ics")) return new NextResponse("not found", { status: 404 });
  const slug = file.slice(0, -4);
  const [row] = await db.select({ event: events, organizationSlug: organizations.slug }).from(events)
    .innerJoin(organizations, eq(events.organizationId, organizations.id))
    .where(and(eq(events.slug, slug), isNull(events.deletedAt), eq(events.status, "published"), ne(events.visibility, "private"))).limit(1);
  if (!row) return new NextResponse("not found", { status: 404 });
  const { event } = row;

  const url = `${env.APP_URL}${publicEventPath(row.organizationSlug, event.slug)}`;
  const location = event.locationType === "online"
    ? "Online"
    : [event.venueName, event.address, event.city].filter(Boolean).join(", ") || null;
  const ics = buildIcs({
    uid: `${event.id}@openticket`, start: event.startsAt, end: event.endsAt, summary: event.name,
    description: [event.descriptionMd, url].filter(Boolean).join("\n\n"), location, url,
  });
  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${event.slug}.ics"`,
      "cache-control": "public, max-age=300",
    },
  });
}
