import path from "node:path";
import { readdir, stat, unlink } from "node:fs/promises";
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** 12 MP covers a 4K cover image; a 5 MB PNG can inflate to ~160 MB of pixels without this cap. */
export const MAX_IMAGE_PIXELS = 12_000_000;
export const MAX_IMAGE_DIMENSION = 6_000;
export const MAX_ORGANIZATION_UPLOAD_BYTES = 250 * 1024 * 1024;
const INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DECODED_FORMATS = new Set(["jpeg", "png", "webp"]); // what the bytes actually are, not what the client claimed
const FILENAME = /^([A-Za-z0-9]{26})-([a-f0-9]{32})\.webp$/;

/** Decodes are memory-heavy; run at most two at a time per process. */
const MAX_CONCURRENT_DECODES = 2;
let activeDecodes = 0;
const waiters: Array<() => void> = [];
async function withDecodeSlot<T>(work: () => Promise<T>): Promise<T> {
  if (activeDecodes >= MAX_CONCURRENT_DECODES) await new Promise<void>((resolve) => waiters.push(resolve));
  activeDecodes++;
  try {
    return await work();
  } finally {
    activeDecodes--;
    waiters.shift()?.();
  }
}

export function hasTrustedRequestOrigin(request: Request, expectedOrigin: string) {
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try { return new URL(referer).origin === expectedOrigin; } catch { return false; }
}

export async function readBoundedRequestBody(request: Request, maxBytes: number) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Request body is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body is required.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Request body is too large.");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export function validateImageUpload(file: Pick<File, "size" | "type">) {
  if (!INPUT_TYPES.has(file.type)) throw new Error("Upload a JPEG, PNG, or WebP image.");
  if (file.size <= 0) throw new Error("Choose a non-empty image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be 5 MB or smaller.");
}

export class ImageUploadError extends Error {}

export async function processImageUpload(file: Pick<File, "arrayBuffer" | "size" | "type">) {
  validateImageUpload(file);
  const input = Buffer.from(await file.arrayBuffer());
  return withDecodeSlot(async () => {
    try {
      const image = sharp(input, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS });
      const metadata = await image.metadata();
      if (!metadata.format || !DECODED_FORMATS.has(metadata.format)) throw new ImageUploadError("Upload a JPEG, PNG, or WebP image.");
      if (!metadata.width || !metadata.height || metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
        throw new ImageUploadError(`Images must be at most ${MAX_IMAGE_DIMENSION} pixels on a side and ${Math.round(MAX_IMAGE_PIXELS / 1e6)} megapixels.`);
      }
      return await image.rotate().webp({ quality: 86 }).toBuffer();
    } catch (error) {
      if (error instanceof ImageUploadError) throw error;
      throw new ImageUploadError("The file is not a valid supported image.");
    }
  });
}

/** UPLOAD_DIR, or `<cwd>/uploads` (apps/web/uploads in dev, /app/uploads in Docker) when unset. Relative values resolve against cwd. */
export function uploadDirectory(configured?: string) {
  return path.resolve(process.cwd(), configured?.trim() || "uploads");
}

export function uploadedImageOwner(filename: string) {
  return FILENAME.exec(filename)?.[1] ?? null;
}

export function uploadedImagePath(filename: string, directory: string) {
  if (!uploadedImageOwner(filename)) return null;
  return path.join(directory, filename);
}

export async function organizationUploadBytes(directory: string, organizationId: string) {
  let total = 0;
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.startsWith(`${organizationId}-`)) continue;
      try {
        total += (await stat(path.join(directory, entry.name))).size;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return total;
}

export async function cleanupOrganizationUploads(directory: string, organizationId: string, referenced: Set<string>, olderThan: Date) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.startsWith(`${organizationId}-`) || referenced.has(entry.name)) continue;
      const filePath = path.join(directory, entry.name);
      try {
        if ((await stat(filePath)).mtime < olderThan) await unlink(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
