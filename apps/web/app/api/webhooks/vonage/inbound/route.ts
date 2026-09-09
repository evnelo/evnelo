import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { attendees } from "@ot/db";
import { smsKeyword } from "@ot/core";
import { db } from "@/lib/db";
import { verifyVonage } from "../_verify";

export const runtime = "nodejs";

/** Inbound SMS (application's inbound URL). Only STOP/START are acted on; everything else is ignored. */
export async function POST(req: Request) {
  const body = await req.text();
  if (!(await verifyVonage(req, body))) return new NextResponse("invalid signature", { status: 400 });
  const msg = JSON.parse(body) as { from?: { number?: string } | string; text?: string };
  const number = typeof msg.from === "string" ? msg.from : msg.from?.number;
  const keyword = msg.text ? smsKeyword(msg.text) : null;
  if (number && keyword) {
    const phone = `+${number.replace(/^\+/, "")}`;
    await db.update(attendees).set({ smsOptIn: keyword === "start" }).where(eq(attendees.phone, phone));
  }
  return NextResponse.json({ received: true });
}
