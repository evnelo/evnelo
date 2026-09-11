import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Fonts for generated Open Graph images (satori needs static TTF/OTF: not woff2, and not the variable Fraunces).
 * Files live in apps/web/assets/fonts and are traced into the standalone build by next.config.
 */
const dir = () => path.join(process.cwd(), "assets", "fonts");
let cache: Promise<{ display: ArrayBuffer; sans: ArrayBuffer; sansMedium: ArrayBuffer }> | undefined;

export function ogFonts() {
  cache ??= Promise.all([readFile(path.join(dir(), "Fraunces-144pt-Medium.ttf")), readFile(path.join(dir(), "Geist-Regular.ttf")), readFile(path.join(dir(), "Geist-Medium.ttf"))])
    .then(([display, sans, sansMedium]) => ({ display: toArrayBuffer(display), sans: toArrayBuffer(sans), sansMedium: toArrayBuffer(sansMedium) }));
  return cache;
}

function toArrayBuffer(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

export const OG_SIZE = { width: 1200, height: 630 };
export const og = { cream: "#f6f4ee", ink: "#17170f", muted: "#6b6a60", green: "#16603a", paper: "#f1e6b2", paperInk: "#2b2407" };
