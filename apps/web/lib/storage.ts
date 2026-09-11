import { randomBytes } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  MAX_REGISTRATION_FILE_BYTES,
  REGISTRATION_FILE_TYPES,
  parseRegistrationFileKey,
  registrationFileKey,
  registrationFilePrefix,
  type ParsedRegistrationFileKey,
  type RegistrationFileType,
} from "@ot/core";
import { env } from "./env";

/**
 * Image storage: the browser uploads straight to S3 (or an S3-compatible bucket) with a
 * presigned POST whose policy pins the key prefix, content type and size. The server never
 * proxies bytes. Public URLs point at CloudFront when configured, else the bucket.
 *
 * Key layout: `{S3_KEY_PREFIX}/uploads/{organizationId}/{random}.{ext}` (prefix defaults to
 * "openticket", so the bucket can be shared with other applications).
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type ImageType = keyof typeof IMAGE_TYPES;

const storageEnv = {
  bucket: env.S3_BUCKET,
  region: env.S3_REGION ?? env.AWS_REGION,
  accessKeyId: env.S3_ACCESS_KEY_ID ?? env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? env.AWS_SECRET_ACCESS_KEY,
  endpoint: env.S3_ENDPOINT,
  cloudfrontDomain: env.CLOUDFRONT_DOMAIN,
  keyPrefix: env.S3_KEY_PREFIX.replace(/^\/+|\/+$/g, ""),
  uploadAcl: env.S3_UPLOAD_ACL,
};

export const storageConfigured = Boolean(storageEnv.bucket && storageEnv.region && storageEnv.accessKeyId && storageEnv.secretAccessKey);

let client: S3Client | undefined;
function s3() {
  if (!storageConfigured) throw new Error("S3 storage is not configured.");
  client ??= new S3Client({
    region: storageEnv.region!,
    credentials: { accessKeyId: storageEnv.accessKeyId!, secretAccessKey: storageEnv.secretAccessKey! },
    ...(storageEnv.endpoint ? { endpoint: storageEnv.endpoint, forcePathStyle: true } : {}),
  });
  return client;
}

/** Folder every upload for an organization lives under; the presign policy and the confirm step both pin it. */
export function uploadPrefix(organizationId: string) {
  return `${storageEnv.keyPrefix}/uploads/${organizationId}/`;
}

/** Object key for a new upload: namespaced by organization, unguessable. */
export function uploadKey(organizationId: string, contentType: ImageType) {
  return `${uploadPrefix(organizationId)}${randomBytes(16).toString("hex")}.${IMAGE_TYPES[contentType]}`;
}

/** The URL we store and serve: CloudFront if set, else the bucket's own address. */
export function publicUrl(key: string, cfg: { cloudfrontDomain?: string; endpoint?: string; bucket: string; region: string } = { cloudfrontDomain: storageEnv.cloudfrontDomain, endpoint: storageEnv.endpoint, bucket: storageEnv.bucket!, region: storageEnv.region! }) {
  if (cfg.cloudfrontDomain) return `https://${cfg.cloudfrontDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}/${key}`;
  if (cfg.endpoint) return `${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucket}/${key}`;
  // bucket names with dots break the wildcard TLS certificate of virtual-hosted URLs; use path style for them
  if (cfg.bucket.includes(".")) return `https://s3.${cfg.region}.amazonaws.com/${cfg.bucket}/${key}`;
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
    Bucket: storageEnv.bucket!,
    Key: key,
    Conditions: [
      ["content-length-range", 1, MAX_IMAGE_BYTES],
      ["eq", "$Content-Type", contentType],
      ["starts-with", "$key", uploadPrefix(organizationId)],
      ...(storageEnv.uploadAcl ? [{ acl: storageEnv.uploadAcl }] : []),
    ],
    Fields: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ...(storageEnv.uploadAcl ? { acl: storageEnv.uploadAcl } : {}),
    },
    Expires: 300,
  });
  return { url, fields, key, publicUrl: publicUrl(key) };
}

/** After the browser's POST: confirm the object matches the policy (size, type); delete anything that doesn't. */
export async function verifyUploadedImage(key: string): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: storageEnv.bucket!, Key: key }));
    const type = head.ContentType ?? "";
    const size = head.ContentLength ?? 0;
    if (!(type in IMAGE_TYPES) || size < 1 || size > MAX_IMAGE_BYTES) {
      await s3().send(new DeleteObjectCommand({ Bucket: storageEnv.bucket!, Key: key })).catch(() => undefined);
      return { ok: false, reason: "The uploaded file is not a JPEG, PNG or WebP under 5 MB." };
    }
    return { ok: true, url: publicUrl(key) };
  } catch {
    return { ok: false, reason: "The upload did not complete. Try again." };
  }
}

export async function deleteUploadedImage(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: storageEnv.bucket!, Key: key }));
}

/* ---------- registration file answers ---------- */

/**
 * Files a registrant attaches to a `file` question live under
 * `{S3_KEY_PREFIX}/registrations/{eventId}/` and are **private**: the policy carries no ACL, so
 * the object inherits the bucket's default and is never reachable over CloudFront. Organizers read
 * one through an authenticated route that mints a short presigned GET.
 */
export function registrationUploadPrefix(eventId: string) {
  return registrationFilePrefix(storageEnv.keyPrefix, eventId);
}

export function newRegistrationFileKey(eventId: string, contentType: RegistrationFileType) {
  return registrationFileKey(storageEnv.keyPrefix, eventId, randomBytes(16).toString("hex"), REGISTRATION_FILE_TYPES[contentType]);
}

export async function presignRegistrationUpload(eventId: string, contentType: RegistrationFileType) {
  const key = newRegistrationFileKey(eventId, contentType);
  const { url, fields } = await createPresignedPost(s3(), {
    Bucket: storageEnv.bucket!,
    Key: key,
    Conditions: [
      ["content-length-range", 1, MAX_REGISTRATION_FILE_BYTES],
      ["eq", "$Content-Type", contentType],
      ["eq", "$key", key], // no `starts-with`: one signature, one object
    ],
    Fields: { "Content-Type": contentType },
    Expires: 300,
  });
  return { url, fields, key };
}

/**
 * Confirms a submitted answer is an object this event's registrants uploaded: right prefix, right
 * event, present in the bucket, allowed type, within the cap. Returns null otherwise, so a
 * fabricated key can never be stored as an answer or turned into a download link.
 */
export async function verifyRegistrationFile(key: unknown, eventId: string): Promise<(ParsedRegistrationFileKey & { contentType: string; contentLength: number }) | null> {
  const parsed = parseRegistrationFileKey(key, { eventId, keyPrefix: storageEnv.keyPrefix });
  if (!parsed) return null;
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: storageEnv.bucket!, Key: parsed.key }));
    const contentType = (head.ContentType ?? "").split(";", 1)[0]!.trim().toLowerCase();
    const contentLength = head.ContentLength ?? 0;
    if (!(contentType in REGISTRATION_FILE_TYPES) || contentLength < 1 || contentLength > MAX_REGISTRATION_FILE_BYTES) return null;
    return { ...parsed, contentType, contentLength };
  } catch {
    return null;
  }
}

/** Short-lived GET for one private file, with the download filename baked into the signature. */
export function presignRegistrationDownload(key: string, options: { filename: string; expiresIn?: number }) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: storageEnv.bucket!,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${options.filename.replace(/["\\]/g, "")}"`,
    }),
    { expiresIn: options.expiresIn ?? 120 },
  );
}

export async function deleteRegistrationFile(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: storageEnv.bucket!, Key: key }));
}
