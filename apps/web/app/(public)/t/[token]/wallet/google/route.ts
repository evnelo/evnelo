import { NextResponse } from "next/server";
import { googleWalletConfigured } from "@/lib/env";
import { loadTicketPass } from "@/lib/wallet";
import { googleWalletSaveUrl } from "@/lib/wallet/google";
import { EVENTS } from "@/lib/analytics-events";
import { track } from "@/lib/posthog-server";

export const runtime = "nodejs";

/** GET /t/{token}/wallet/google → redirect to the signed "Save to Google Wallet" link. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!googleWalletConfigured) return new NextResponse("not configured", { status: 404 });
  const data = await loadTicketPass((await params).token);
  if (!data) return new NextResponse("not found", { status: 404 });
  track(EVENTS.walletAdded, { distinctId: data.ticketId, anonymous: true, properties: { eventId: data.eventId, wallet: "google" } });
  return NextResponse.redirect(await googleWalletSaveUrl(data), { status: 307, headers: { "cache-control": "private, no-store" } });
}
