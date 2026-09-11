import { ImageResponse } from "next/og";
import { OG_SIZE, og, ogFonts } from "@/lib/og";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "OpenTicket";

/** Default share card for pages without their own (discover, organization pages, sign-in). */
export default async function DefaultOgImage() {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: og.cream, color: og.ink, fontFamily: "Geist" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 14, background: og.green }}>
            <div style={{ width: 30, height: 20, borderRadius: 5, border: `3px solid ${og.cream}`, display: "flex" }} />
          </div>
          <span style={{ fontFamily: "Fraunces", fontSize: 40 }}>OpenTicket</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontFamily: "Fraunces", fontSize: 92, lineHeight: 1, letterSpacing: -2, display: "flex" }}>Tickets, without the tax on joy.</div>
          <div style={{ fontSize: 32, color: og.muted, display: "flex" }}>Open-source ticketing. Free events are free; paid events cost the host 0.99%.</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: [{ name: "Fraunces", data: fonts.display, weight: 500, style: "normal" }, { name: "Geist", data: fonts.sans, weight: 400, style: "normal" }, { name: "Geist", data: fonts.sansMedium, weight: 500, style: "normal" }] },
  );
}
