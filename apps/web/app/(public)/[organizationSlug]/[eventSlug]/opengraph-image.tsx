import { ImageResponse } from "next/og";
import { getLocale, getTranslations } from "next-intl/server";
import { canView } from "@evnelo/core";
import { getPublicEvent } from "@/lib/queries/events";
import { OG_SIZE, SYMBOL_PATH, og, ogFontList } from "@/lib/og";
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
  const fontList = await ogFontList();
  const visible = data && canView(data.event, { isMember: false, hasInvite: false }) && data.event.visibility !== "private";
  if (!visible) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 18, background: og.paper, color: og.ink, fontFamily: "Instrument Sans", fontSize: 64, fontWeight: 600, letterSpacing: -2 }}>
        <svg viewBox="20 20 410 410" width={80} height={80}><path d={SYMBOL_PATH} fill={og.pulse} fillRule="evenodd" /></svg>evnelo
      </div>,
      { ...OG_SIZE, fonts: fontList },
    );
  }
  const { event, org, ticketTypes } = data;
  const [t, locale] = await Promise.all([getTranslations("event"), getLocale()]);
  const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone: event.timezone }).format(event.startsAt);
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: event.timezone }).format(event.startsAt);
  const when = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: event.timezone }).format(event.startsAt);
  const prices = ticketTypes.map((tt) => tt.priceMinor);
  const min = prices.length ? Math.min(...prices) : null;
  const price = min == null ? null : min === 0 ? t("og.free") : t("og.from", { price: formatMoney(min, ticketTypes[0]!.currency, locale) });
  const where = event.locationType === "online" ? t("og.online") : [event.venueName, event.city].filter(Boolean).join(", ");
  const hasCover = Boolean(event.coverImageUrl);
  const fg = hasCover ? "#ffffff" : og.ink;
  const fgMuted = hasCover ? "rgba(255,255,255,0.82)" : og.muted;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: og.paper, fontFamily: "Instrument Sans", color: fg }}>
        {hasCover && <img src={event.coverImageUrl!} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        {hasCover && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(23,23,15,0.86) 0%, rgba(23,23,15,0.45) 55%, rgba(23,23,15,0.15) 100%)" }} />}
        <div style={{ position: "absolute", left: 64, right: 64, top: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 500 }}>
            {org.logoUrl
              ? <img src={org.logoUrl} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: 10, objectFit: "contain", background: "#ffffff" }} />
              : <svg viewBox="20 20 410 410" width={44} height={44}><path d={SYMBOL_PATH} fill={og.pulse} fillRule="evenodd" /></svg>}
            <span>{org.name}</span>
          </div>
          {price && <div style={{ display: "flex", padding: "10px 20px", borderRadius: 999, fontSize: 24, fontWeight: 500, background: hasCover ? "rgba(255,255,255,0.16)" : og.ink, color: hasCover ? "#ffffff" : og.paper, border: hasCover ? "1px solid rgba(255,255,255,0.35)" : "none" }}>{price}</div>}
        </div>
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 60, display: "flex", alignItems: "flex-end", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 128, borderRadius: 16, overflow: "hidden", background: "#ffffff", color: og.ink, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "center", background: og.pulse, color: og.white, fontSize: 22, fontWeight: 600, letterSpacing: 2, padding: "8px 0", textTransform: "uppercase" }}>{month}</div>
            <div style={{ display: "flex", justifyContent: "center", fontSize: 76, fontWeight: 700, lineHeight: 1, letterSpacing: -3, padding: "14px 0 12px" }}>{day}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 14 }}>
            <div style={{ fontSize: event.name.length > 40 ? 56 : 70, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2.5, display: "flex" }}>{event.name}</div>
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
