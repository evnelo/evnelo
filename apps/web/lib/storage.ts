import { randomBytes } from "node:crypto";
import { DeleteObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { env } from "./env";

/**
 * Image storage: the browser uploads straight to S3 (or an S3-compatible bucket) with a
 * presigned POST whose policy pins the key prefix, content type and size. The server never
 * proxies bytes. Public URLs point at CloudFront when configured, else the bucket.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type ImageType = keyof typeof IMAGE_TYPES;

export const storageConfigured = Boolean(env.S3_BUCKET && env.AWS_REGION && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);

let client: S3Client | undefined;
function s3() {
  if (!storageConfigured) throw new Error("S3 storage is not configured.");
  client ??= new S3Client({
    region: env.AWS_REGION!,
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID!, secretAccessKey: env.AWS_SECRET_ACCESS_KEY! },
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
  });
  return client;
}

/** Object key for a new upload: namespaced by organization, unguessable. */
export function uploadKey(organizationId: string, contentType: ImageType) {
  return `uploads/${organizationId}/${randomBytes(16).toString("hex")}.${IMAGE_TYPES[contentType]}`;
}

/** The URL we store and serve: CloudFront if set, else the bucket's own address. */
export function publicUrl(key: string, cfg: { cloudfrontDomain?: string; endpoint?: string; bucket: string; region: string } = { cloudfrontDomain: env.CLOUDFRONT_DOMAIN, endpoint: env.S3_ENDPOINT, bucket: env.S3_BUCKET!, region: env.AWS_REGION! }) {
  if (cfg.cloudfrontDomain) return `https://${cfg.cloudfrontDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}/${key}`;
  if (cfg.endpoint) return `${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucket}/${key}`;
  return `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${key}`;
}

/** Is this URL one of ours (so we can HEAD/delete it by key)? */
export function keyFromPublicUrl(url: string): string | null {
  const base = publicUrl("");
  return url.startsWith(base) ? url.slice(base.length) : null;
}

export async function presignImageUpload(organizationId: string, contentType: ImageType) {
  const key = uploadKey(organizationId, contentType);
  const { url, fields } = await createPresignedPost(s3(), {
    Bucket: env.S3_BUCKET!,
    Key: key,
    Conditions: [
      ["content-length-range", 1, MAX_IMAGE_BYTES],
      ["eq", "$Content-Type", contentType],
      ["starts-with", "$key", `uploads/${organizationId}/`],
    ],
    Fields: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
    Expires: 300,
  });
  return { url, fields, key, publicUrl: publicUrl(key) };
}

/** After the browser's POST: confirm the object matches the policy (size, type); delete anything that doesn't. */
export async function verifyUploadedImage(key: string): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: env.S3_BUCKET!, Key: key }));
    const type = head.ContentType ?? "";
    const size = head.ContentLength ?? 0;
    if (!(type in IMAGE_TYPES) || size < 1 || size > MAX_IMAGE_BYTES) {
      await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET!, Key: key })).catch(() => undefined);
      return { ok: false, reason: "The uploaded file is not a JPEG, PNG or WebP under 5 MB." };
    }
    return { ok: true, url: publicUrl(key) };
  } catch {
    return { ok: false, reason: "The upload did not complete. Try again." };
  }
}

export async function deleteUploadedImage(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET!, Key: key }));
}
