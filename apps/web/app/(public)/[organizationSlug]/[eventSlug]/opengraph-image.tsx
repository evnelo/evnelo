import { ImageResponse } from "next/og";
import { canView } from "@ot/core";
import { getPublicEvent } from "@/lib/queries/events";
import { OG_SIZE, og, ogFonts } from "@/lib/og";
import { formatMoney } from "@/lib/utils";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Event";

/**
 * Share card for an event: cover (or cream), date leaf, title in the display serif, host and price.
 * Rendered on demand; private/draft events get a neutral card so nothing leaks through previews.
 */
export default async function EventOgImage({ params }: { params: Promise<{ organizationSlug: string; eventSlug: string }> }) {
  const { organizationSlug, eventSlug } = await params;
  const data = await getPublicEvent(organizationSlug, eventSlug);
  const fonts = await ogFonts();
  const fontList = [
    { name: "Fraunces", data: fonts.display, weight: 500 as const, style: "normal" as const },
    { name: "Geist", data: fonts.sans, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: fonts.sansMedium, weight: 500 as const, style: "normal" as const },
  ];
  const visible = data && canView(data.event, { isMember: false, hasInvite: false }) && data.event.visibility !== "private";
  if (!visible) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: og.cream, color: og.ink, fontFamily: "Fraunces", fontSize: 64 }}>OpenTicket</div>,
      { ...OG_SIZE, fonts: fontList },
    );
  }
  const { event, org, ticketTypes } = data;
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: event.timezone }).format(event.startsAt);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: event.timezone }).format(event.startsAt);
  const when = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: event.timezone }).format(event.startsAt);
  const prices = ticketTypes.map((t) => t.priceMinor);
  const min = prices.length ? Math.min(...prices) : null;
  const price = min == null ? null : min === 0 ? "Free" : `from ${formatMoney(min, ticketTypes[0]!.currency)}`;
  const where = event.locationType === "online" ? "Online" : [event.venueName, event.city].filter(Boolean).join(", ");
  const hasCover = Boolean(event.coverImageUrl);
  const fg = hasCover ? "#ffffff" : og.ink;
  const fgMuted = hasCover ? "rgba(255,255,255,0.82)" : og.muted;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: og.cream, fontFamily: "Geist", color: fg }}>
        {hasCover && <img src={event.coverImageUrl!} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {hasCover && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(23,23,15,0.86) 0%, rgba(23,23,15,0.45) 55%, rgba(23,23,15,0.15) 100%)" }} />}
        <div style={{ position: "absolute", left: 64, right: 64, top: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 500 }}>
            {org.logoUrl
              ? <img src={org.logoUrl} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: 10, objectFit: "contain", background: "#ffffff" }} />
              : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 10, background: hasCover ? "rgba(255,255,255,0.18)" : og.green }}>
                  <div style={{ width: 24, height: 16, borderRadius: 4, border: `2.5px solid ${hasCover ? "#ffffff" : og.cream}`, display: "flex" }} />
                </div>}
            <span>{org.name}</span>
          </div>
          {price && <div style={{ display: "flex", padding: "10px 20px", borderRadius: 999, fontSize: 24, fontWeight: 500, background: hasCover ? "rgba(255,255,255,0.16)" : og.paper, color: hasCover ? "#ffffff" : og.paperInk, border: hasCover ? "1px solid rgba(255,255,255,0.35)" : "none" }}>{price}</div>}
        </div>
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 60, display: "flex", alignItems: "flex-end", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 128, borderRadius: 16, overflow: "hidden", background: "#ffffff", color: og.ink, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "center", background: og.green, color: og.cream, fontSize: 22, fontWeight: 500, letterSpacing: 2, padding: "8px 0", textTransform: "uppercase" }}>{month}</div>
            <div style={{ display: "flex", justifyContent: "center", fontFamily: "Fraunces", fontSize: 76, lineHeight: 1, padding: "14px 0 12px" }}>{day}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 14 }}>
            <div style={{ fontFamily: "Fraunces", fontSize: event.name.length > 40 ? 58 : 72, lineHeight: 1.02, letterSpacing: -1.5, display: "flex" }}>{event.name}</div>
            <div style={{ display: "flex", gap: 18, fontSize: 28, color: fgMuted }}>
              <span>{when}</span>
              {where && <span>·</span>}
              {where && <span>{where}</span>}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fontList },
  );
}
