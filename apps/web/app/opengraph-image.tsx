import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { OG_SIZE, SYMBOL_PATH, og, ogFontList } from "@/lib/og";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Evnelo";

/** Default share card: wordmark, tagline, the Flow Line motif (brand book §15). */
export default async function DefaultOgImage() {
  const [fonts, t, tc] = await Promise.all([ogFontList(), getTranslations("public"), getTranslations("common")]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: og.paper, color: og.ink, fontFamily: "Instrument Sans" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg viewBox="20 20 410 410" width={52} height={52}><path d={SYMBOL_PATH} fill={og.pulse} fillRule="evenodd" /></svg>
          <span style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.5 }}>evnelo</span>
        </div>
        <svg width="1056" height="120" viewBox="0 0 1056 120" style={{ position: "absolute", left: 72, top: 250 }}>
          <path d="M8 90 C 200 90, 240 30, 420 30 S 640 90, 820 90 S 980 40, 1048 40" stroke={og.pulse} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="8" cy="90" r="9" fill={og.pulse} />
          <circle cx="420" cy="30" r="9" fill={og.lime} stroke={og.ink} strokeWidth="2" />
          <circle cx="820" cy="90" r="9" fill={og.sky} stroke={og.ink} strokeWidth="2" />
          <circle cx="1048" cy="40" r="9" fill={og.pulse} />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1, letterSpacing: -4, display: "flex" }}>{tc("tagline")}</div>
          <div style={{ fontSize: 32, color: og.muted, display: "flex" }}>{t("og.subtitle")}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
