import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import QRCode from "qrcode";
import { tickets } from "@ot/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/** QR for a ticket, rendered locally so ticket URLs never leave this instance. Encodes /t/{token}. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const format = new URL(req.url).searchParams.get("format") === "png" ? "png" : "svg"; // png for email clients
  const [ticket] = await db.select({ id: tickets.id }).from(tickets)
    .where(and(eq(tickets.token, token), isNull(tickets.revokedAt))).limit(1);
  if (!ticket) return new NextResponse("not found", { status: 404 });

  const url = `${env.APP_URL}/t/${token}`;
  const color = { dark: "#2b2407", light: "#ffffff" };
  const headers = { "cache-control": "private, max-age=86400", "x-robots-tag": "noindex" };
  if (format === "png") {
    const png = await QRCode.toBuffer(url, { type: "png", errorCorrectionLevel: "M", margin: 1, width: 320, color });
    return new NextResponse(new Uint8Array(png), { headers: { ...headers, "content-type": "image/png" } });
  }
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 0, color });
  return new NextResponse(svg, { headers: { ...headers, "content-type": "image/svg+xml" } });
}
