import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { notifications } from "@evnelo/db";
import { db } from "@/lib/db";
import { verifyVonage } from "../_verify";

export const runtime = "nodejs";

/** Messages API status callbacks: submitted → delivered | rejected | undeliverable. Set as the application's status URL. */
export async function POST(req: Request) {
  const body = await req.text();
  if (!(await verifyVonage(req, body))) return new NextResponse("invalid signature", { status: 400 });
  const ev = JSON.parse(body) as { message_uuid?: string; status?: string; error?: { reason?: string; code?: number } };
  if (ev.message_uuid) {
    if (ev.status === "delivered") {
      await db.update(notifications).set({ status: "delivered", error: null }).where(eq(notifications.providerMessageId, ev.message_uuid));
    } else if (ev.status === "rejected" || ev.status === "undeliverable") {
      await db.update(notifications).set({ status: "failed", error: `${ev.status}: ${ev.error?.reason ?? ev.error?.code ?? "no reason"}`.slice(0, 300) }).where(eq(notifications.providerMessageId, ev.message_uuid));
    }
  }
  return NextResponse.json({ received: true });
}
