import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import QRCode from "qrcode";
import { tickets } from "@ot/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/** QR for a ticket, rendered locally so ticket URLs never leave this instance. Encodes /t/{token}. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [ticket] = await db.select({ id: tickets.id }).from(tickets)
    .where(and(eq(tickets.token, token), isNull(tickets.revokedAt))).limit(1);
  if (!ticket) return new NextResponse("not found", { status: 404 });

  const svg = await QRCode.toString(`${env.APP_URL}/t/${token}`, {
    type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#2b2407", light: "#ffffff" },
  });
  return new NextResponse(svg, {
    headers: { "content-type": "image/svg+xml", "cache-control": "private, max-age=86400", "x-robots-tag": "noindex" },
  });
}
