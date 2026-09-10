import path from "node:path";
import { readdir, stat, unlink } from "node:fs/promises";
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const MAX_ORGANIZATION_UPLOAD_BYTES = 250 * 1024 * 1024;
const INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FILENAME = /^([A-Za-z0-9]{26})-([a-f0-9]{32})\.webp$/;

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

export async function processImageUpload(file: Pick<File, "arrayBuffer" | "size" | "type">) {
  validateImageUpload(file);
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(input, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 8000 || metadata.height > 8000) {
      throw new Error("Image dimensions must be 8,000 × 8,000 pixels or smaller.");
    }
    return await image.rotate().webp({ quality: 86 }).toBuffer();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Image dimensions")) throw error;
    throw new Error("The file is not a valid supported image.");
  }
}

export function uploadDirectory(configured?: string) {
  if (!configured || !path.isAbsolute(configured)) throw new Error("UPLOAD_DIR must be configured as an absolute path.");
  return path.normalize(configured);
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
