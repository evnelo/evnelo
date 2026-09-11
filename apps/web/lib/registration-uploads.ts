/**
 * Request-side rules for registration `file` answers. Kept apart from lib/storage.ts so the
 * validation is pure and unit testable: no bucket, no credentials, no clock.
 */
import { MAX_REGISTRATION_FILE_BYTES, REGISTRATION_FILE_TYPES, type RegistrationFileType } from "@evnelo/core";

export const REGISTRATION_UPLOAD_EXPIRY_SECONDS = 300;
export const REGISTRATION_DOWNLOAD_EXPIRY_SECONDS = 120;

/**
 * Hourly quotas. Every upload consumes the event limit plus one identity limit: a per-address one
 * when API_TRUSTED_PROXY_HEADER identifies callers, otherwise a shared global one — without that
 * header `clientAddress` is null for everyone, so a tight per-client limit would lock the first
 * twenty registrants out of every other event's form.
 */
export const REGISTRATION_UPLOAD_CLIENT_LIMIT = 20;
export const REGISTRATION_UPLOAD_GLOBAL_LIMIT = 600;
export const REGISTRATION_UPLOAD_EVENT_LIMIT = 300;
export const REGISTRATION_UPLOAD_WINDOW_MS = 60 * 60_000;

export type RegistrationUploadRequest = { eventId: string; contentType: string; size: number };
export type PlannedRegistrationUpload =
  | { ok: true; eventId: string; contentType: RegistrationFileType }
  | { ok: false; status: 400 | 413 | 415; error: string };

/** Validates what the browser asked for before anything is signed. */
export function planRegistrationUpload(request: RegistrationUploadRequest): PlannedRegistrationUpload {
  const contentType = request.contentType.split(";", 1)[0]!.trim().toLowerCase();
  if (!(contentType in REGISTRATION_FILE_TYPES)) return { ok: false, status: 415, error: "Upload a PDF, JPEG, PNG or WebP file." };
  if (!Number.isFinite(request.size) || request.size <= 0) return { ok: false, status: 400, error: "Choose a file to upload." };
  if (request.size > MAX_REGISTRATION_FILE_BYTES) return { ok: false, status: 413, error: "Files must be 10 MB or smaller." };
  if (!/^[A-Za-z0-9]{26}$/.test(request.eventId)) return { ok: false, status: 400, error: "Unknown event." };
  return { ok: true, eventId: request.eventId, contentType: contentType as RegistrationFileType };
}
