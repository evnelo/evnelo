import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { uploadAccess } from "@/lib/upload-access";
import { readJsonBody } from "@/lib/api-http";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, keyFromPublicUrl, presignImageUpload, storageConfigured, verifyUploadedImage, type ImageType } from "@/lib/storage";

export const runtime = "nodejs";

const presignInput = z.object({ contentType: z.enum(Object.keys(IMAGE_TYPES) as [ImageType, ...ImageType[]]), size: z.number().int().min(1).max(MAX_IMAGE_BYTES) });
const confirmInput = z.object({ url: z.string().url() });

function trustedOrigin(request: Request) {
  const expected = new URL(env.APP_URL).origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === expected;
  const referer = request.headers.get("referer");
  try { return !!referer && new URL(referer).origin === expected; } catch { return false; }
}

/**
 * POST /api/uploads → a presigned S3 POST the browser uses to upload the image directly.
 * The policy pins the key prefix (this organization), the content type and the size.
 */
export async function POST(request: Request) {
  if (!storageConfigured) return NextResponse.json({ error: "Image uploads aren't configured on this instance (S3). Paste an image URL instead." }, { status: 503 });
  if (!trustedOrigin(request)) return NextResponse.json({ error: "Invalid upload origin." }, { status: 403 });
  const access = await uploadAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!(await consumeSharedRateLimit("upload", access.user.id, 30, 60 * 60_000))) return NextResponse.json({ error: "Upload limit reached. Try again later." }, { status: 429 });
  const parsed = presignInput.safeParse(await readJsonBody(request, 1_024).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Upload a JPEG, PNG or WebP image of 5 MB or less." }, { status: 400 });
  try {
    return NextResponse.json(await presignImageUpload(access.org.id, parsed.data.contentType));
  } catch (error) {
    console.error("[uploads] presign failed", error);
    return NextResponse.json({ error: "Image storage is unavailable right now." }, { status: 503 });
  }
}

/** PUT /api/uploads → after the browser's S3 POST: verify the object and return the URL to store. */
export async function PUT(request: Request) {
  if (!storageConfigured) return NextResponse.json({ error: "Image uploads aren't configured on this instance." }, { status: 503 });
  if (!trustedOrigin(request)) return NextResponse.json({ error: "Invalid upload origin." }, { status: 403 });
  const access = await uploadAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = confirmInput.safeParse(await readJsonBody(request, 2_048).catch(() => null));
  const key = parsed.success ? keyFromPublicUrl(parsed.data.url) : null;
  if (!key || !key.startsWith(`uploads/${access.org.id}/`)) return NextResponse.json({ error: "That file isn't one of this organization's uploads." }, { status: 400 });
  const result = await verifyUploadedImage(key);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 });
  return NextResponse.json({ url: result.url });
}
