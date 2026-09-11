import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { computeOrder, currentEdition } from "@ot/core";
import { discountProblem, discountProblemMessage, findDiscountCode, toDiscount } from "@ot/core/services";
import { events, ticketTypes } from "@ot/db";
import { db } from "@/lib/db";
import { clientAddress, readJsonBody } from "@/lib/api-http";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";

export const runtime = "nodejs";

const input = z.object({ eventId: z.string().length(26), ticketTypeId: z.string().length(26), code: z.string().trim().min(1).max(40), quantity: z.number().int().min(1).max(50).default(1) });

/** Checkout preview: is this code good, and what does the order come to? Same rules as POST /api/orders. */
export async function POST(request: Request) {
  const parsed = input.safeParse(await readJsonBody(request, 2_048).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a code." }, { status: 400 });
  const { eventId, ticketTypeId, code, quantity } = parsed.data;
  const address = clientAddress(request);
  const allowed = await Promise.all([address ? consumeSharedRateLimit("discount:client", address, 30, 10 * 60_000) : true, consumeSharedRateLimit("discount:event", eventId, 1_000, 60_000)]);
  if (allowed.includes(false)) return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429, headers: { "Retry-After": "60" } });
  const [row] = await db.select({ feePassThrough: events.feePassThrough, tt: ticketTypes }).from(ticketTypes).innerJoin(events, eq(events.id, ticketTypes.eventId))
    .where(and(eq(ticketTypes.id, ticketTypeId), eq(ticketTypes.eventId, eventId), eq(events.status, "published"))).limit(1);
  if (!row) return NextResponse.json({ error: "That ticket isn't available." }, { status: 404 });
  const dc = await findDiscountCode(db, eventId, code);
  const problem = discountProblem(dc);
  if (problem) return NextResponse.json({ error: discountProblemMessage[problem] }, { status: 404 });
  const fees = computeOrder([{ unitPriceMinor: row.tt.priceMinor, quantity, taxRateBps: row.tt.taxRateBps }], { edition: currentEdition(), feePassThrough: row.feePassThrough, discount: toDiscount(dc!) });
  return NextResponse.json({ code: dc!.code, kind: dc!.kind, value: dc!.value, discountMinor: fees.discountMinor, totalMinor: fees.totalMinor, currency: row.tt.currency }, { headers: { "Cache-Control": "no-store" } });
}
