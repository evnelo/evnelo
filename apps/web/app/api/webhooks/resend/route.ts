import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { notifications } from "@ot/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/** Resend signs with the Svix scheme: HMAC-SHA256 over "{id}.{timestamp}.{body}" with the base64 secret. */
function verify(req: Request, body: string) {
  if (!env.RESEND_WEBHOOK_SECRET) return false;
  const id = req.headers.get("svix-id"), ts = req.headers.get("svix-timestamp"), sigs = req.headers.get("svix-signature");
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const secret = Buffer.from(env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", secret).update(`${id}.${ts}.${body}`).digest();
  return sigs.split(" ").some((pair) => {
    const [version, sig] = pair.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

const statusFor: Record<string, "delivered" | "bounced" | undefined> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "bounced",
};

export async function POST(req: Request) {
  const body = await req.text();
  if (!verify(req, body)) return new NextResponse("invalid signature", { status: 400 });
  const event = JSON.parse(body) as { type: string; data?: { email_id?: string; bounce?: { message?: string } } };
  const status = statusFor[event.type];
  const id = event.data?.email_id;
  if (status && id) {
    await db.update(notifications)
      .set({ status, error: status === "bounced" ? (event.data?.bounce?.message ?? event.type).slice(0, 300) : null })
      .where(eq(notifications.providerMessageId, id));
  }
  return NextResponse.json({ received: true });
}
