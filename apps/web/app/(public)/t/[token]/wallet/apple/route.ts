import { NextResponse } from "next/server";
import { appleWalletConfigured } from "@/lib/env";
import { loadTicketPass } from "@/lib/wallet";
import { buildApplePass } from "@/lib/wallet/apple";
import { EVENTS } from "@/lib/analytics-events";
import { track } from "@/lib/posthog-server";

export const runtime = "nodejs";

/** GET /t/{token}/wallet/apple → signed .pkpass. 404 unless Apple Wallet is configured. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!appleWalletConfigured) return new NextResponse("not configured", { status: 404 });
  const data = await loadTicketPass((await params).token);
  if (!data) return new NextResponse("not found", { status: 404 });
  track(EVENTS.walletAdded, { distinctId: data.ticketId, anonymous: true, properties: { eventId: data.eventId, wallet: "apple" } });
  const pkpass = await buildApplePass(data);
  return new NextResponse(new Uint8Array(pkpass), {
    headers: {
      "content-type": "application/vnd.apple.pkpass",
      "content-disposition": `attachment; filename="${data.eventSlug}.pkpass"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
