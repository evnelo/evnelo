import { ImageResponse } from "next/og";
import { SYMBOL_PATH, og } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The favicon as a PNG (icon.svg's symbol on Ink): iOS home screens, and the logo in the home page's structured data. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: og.ink }}>
        <svg viewBox="20 20 410 410" width={124} height={124}><path d={SYMBOL_PATH} fill={og.pulse} fillRule="evenodd" /></svg>
      </div>
    ),
    size,
  );
}
