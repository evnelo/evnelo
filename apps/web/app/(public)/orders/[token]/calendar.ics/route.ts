import { eq } from "drizzle-orm";
import { events, orders, organizations } from "@evnelo/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { holderCalendarResponse } from "@/lib/calendar";
import { orderPath } from "@/lib/urls";

export const runtime = "nodejs";

/** GET /orders/{token}/calendar.ics: the event with a link back to the order page and all its tickets. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db
    .select({ event: events, org: organizations })
    .from(orders)
    .innerJoin(events, eq(orders.eventId, events.id))
    .innerJoin(organizations, eq(events.organizationId, organizations.id))
    .where(eq(orders.accessToken, token))
    .limit(1);
  return holderCalendarResponse(row ?? null, { kind: "order", link: `${env.APP_URL}${orderPath(token)}` });
}
