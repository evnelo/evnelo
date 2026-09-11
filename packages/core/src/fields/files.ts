/**
 * Registration file answers.
 *
 * A `file` field stores the **object key** of a private upload, never a URL: the object lives
 * outside the public `uploads/` prefix, carries no ACL, and is only reachable through an
 * authenticated dashboard route that issues a short-lived presigned GET.
 *
 * Keys look like `{S3_KEY_PREFIX}/registrations/{eventId}/{random}.{ext}`. The bucket prefix is
 * deployment configuration and core is browser-safe, so the helpers here validate the shape and
 * the event binding; the server re-derives the expected prefix from its own environment and HEADs
 * the object before an answer is accepted (`verifyRegistrationFile` in apps/web).
 */

export const REGISTRATION_SEGMENT = "registrations";

/** Content types a registrant may upload, mapped to the extension stored in the key. */
export const REGISTRATION_FILE_TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type RegistrationFileType = keyof typeof REGISTRATION_FILE_TYPES;
export const REGISTRATION_FILE_CONTENT_TYPES = Object.keys(REGISTRATION_FILE_TYPES) as RegistrationFileType[];
export const REGISTRATION_FILE_EXTENSIONS = [...new Set(Object.values(REGISTRATION_FILE_TYPES))];
export const MAX_REGISTRATION_FILE_BYTES = 10 * 1024 * 1024;

// prefix charset deliberately excludes "." so no segment can be a traversal
const KEY = new RegExp(
  `^([a-z0-9][a-z0-9_/-]*)/${REGISTRATION_SEGMENT}/([A-Za-z0-9]{26})/([a-f0-9]{32})\\.(${REGISTRATION_FILE_EXTENSIONS.join("|")})$`,
);

export function registrationFileExtension(contentType: string): string | null {
  const type = contentType.split(";", 1)[0]!.trim().toLowerCase();
  return REGISTRATION_FILE_TYPES[type as RegistrationFileType] ?? null;
}

export function registrationFilePrefix(keyPrefix: string, eventId: string): string {
  return `${keyPrefix.replace(/^\/+|\/+$/g, "")}/${REGISTRATION_SEGMENT}/${eventId}/`;
}

export function registrationFileKey(keyPrefix: string, eventId: string, random: string, extension: string): string {
  return `${registrationFilePrefix(keyPrefix, eventId)}${random}.${extension}`;
}

export type ParsedRegistrationFileKey = { key: string; keyPrefix: string; eventId: string; name: string; extension: string };

export function parseRegistrationFileKey(key: unknown, opts: { eventId?: string; keyPrefix?: string } = {}): ParsedRegistrationFileKey | null {
  if (typeof key !== "string") return null;
  const match = KEY.exec(key);
  if (!match) return null;
  const parsed = { key, keyPrefix: match[1]!, eventId: match[2]!, name: match[3]!, extension: match[4]! };
  if (opts.eventId && parsed.eventId !== opts.eventId) return null;
  if (opts.keyPrefix && parsed.keyPrefix !== opts.keyPrefix.replace(/^\/+|\/+$/g, "")) return null;
  return parsed;
}

/** True when `key` is a well-formed registration upload key, optionally bound to one event. */
export function isRegistrationFileKey(key: unknown, eventId?: string): boolean {
  return parseRegistrationFileKey(key, { eventId }) !== null;
}

/** Dashboard download path; the route re-checks membership before redirecting to a presigned GET. */
export function registrationFileDownloadPath(key: string): string | null {
  const parsed = parseRegistrationFileKey(key);
  return parsed ? `/api/uploads/registration/${parsed.eventId}/${parsed.name}.${parsed.extension}` : null;
}
