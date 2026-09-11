import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { attendees } from "@evnelo/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyUnsubscribeToken } from "@/lib/notifications/unsubscribe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get("token") ?? "");
  const attendeeId = verifyUnsubscribeToken(token);
  if (!attendeeId) return new NextResponse("invalid link", { status: 400 });
  await db.update(attendees).set({ remindersOptOut: true }).where(eq(attendees.id, attendeeId));
  return NextResponse.redirect(`${env.APP_URL}/unsubscribe/${token}?done=1`, { status: 303 });
}
