import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { events } from "@evnelo/db";
import { deviceFromUserAgent, markVisitMilestone, recordVisit, referrerHost, utcDay, utmFromSearch, visitorHash } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { clientAddress, readJsonBody, sameOriginRequest } from "@/lib/api-http";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { captureError } from "@/lib/observability";

export const runtime = "nodejs";

const input = z.object({
  eventId: z.string().length(26),
  milestone: z.enum(["view", "opened"]).default("view"),
  referrer: z.string().max(2048).optional(),
  search: z.string().max(2048).optional(),
});
const done = () => new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });

/**
 * The event page beacon (components/visit-beacon.tsx): first-party analytics for hosts, with no
 * cookie and no third party. The visitor is a daily-salted hash of address and browser, computed
 * here and never stored in the clear. Always 204: a beacon has nothing to report back, and a bad
 * or throttled one must not surface in the browser.
 */
export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return done();
  const parsed = input.safeParse(await readJsonBody(request, 8_192).catch(() => null));
  if (!parsed.success) return done();
  const address = clientAddress(request);
  if (address && !(await consumeSharedRateLimit("visit", address, 240, 60_000))) return done();
  const [event] = await db.select({ id: events.id }).from(events).where(and(eq(events.id, parsed.data.eventId), isNull(events.deletedAt))).limit(1);
  if (!event) return done();
  const userAgent = request.headers.get("user-agent");
  const day = utcDay();
  const key = { eventId: event.id, day, visitorHash: visitorHash(env.AUTH_SECRET, day, address, userAgent) };
  try {
    if (parsed.data.milestone === "opened") {
      await markVisitMilestone(db, key, "opened");
    } else {
      await recordVisit(db, { ...key, referrerHost: referrerHost(parsed.data.referrer, new URL(env.APP_URL).host), ...utmFromSearch(parsed.data.search), country: countryOf(request), device: deviceFromUserAgent(userAgent) });
    }
  } catch (e) {
    captureError("visit.record", e, { eventId: event.id });
  }
  return done();
}

/** Only Cloudflare's country header, and only when the deployment says Cloudflare is in front. */
function countryOf(request: Request) {
  if (env.API_TRUSTED_PROXY_HEADER !== "cf-connecting-ip") return null;
  const code = request.headers.get("cf-ipcountry")?.toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "T1" ? code : null;
}
