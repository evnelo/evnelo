import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { events, registrationFields } from "@evnelo/db";
import { MAX_REGISTRATION_FILE_BYTES, REGISTRATION_FILE_CONTENT_TYPES } from "@evnelo/core";
import { db } from "@/lib/db";
import { clientAddress, readJsonBody } from "@/lib/api-http";
import { captureError } from "@/lib/observability";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import {
  REGISTRATION_UPLOAD_CLIENT_LIMIT,
  REGISTRATION_UPLOAD_EVENT_LIMIT,
  REGISTRATION_UPLOAD_GLOBAL_LIMIT,
  REGISTRATION_UPLOAD_WINDOW_MS,
  planRegistrationUpload,
} from "@/lib/registration-uploads";
import { presignRegistrationUpload, storageConfigured } from "@/lib/storage";
import { trackRegistrationUpload } from "@evnelo/core/services";

export const runtime = "nodejs";

const capability = { maxBytes: MAX_REGISTRATION_FILE_BYTES, contentTypes: REGISTRATION_FILE_CONTENT_TYPES };

// planRegistrationUpload (lib/registration-uploads.ts) is pure and reports its reason in English; map it to a message key here.
const planErrorKey: Record<string, string> = {
  "Upload a PDF, JPEG, PNG or WebP file.": "errors.uploadType",
  "Choose a file to upload.": "errors.chooseFile",
  "Files must be 10 MB or smaller.": "errors.uploadTooLarge",
  "Unknown event.": "errors.unknownEvent",
};

/** Lets the registration form render an upload control or a disabled notice without prop drilling. */
export function GET() {
  return NextResponse.json({ enabled: storageConfigured, ...capability }, { headers: { "cache-control": "no-store" } });
}

const input = z.object({
  eventId: z.string().length(26),
  contentType: z.string().min(1).max(120),
  size: z.number().int().positive(),
});

/**
 * POST /api/uploads/registration → a presigned S3 POST for one registration file answer.
 *
 * Anonymous by necessity, since registrants have no account, so the limits are the defence: the
 * event must be published and actually ask for a file, the policy pins key, content type and a
 * 10 MB ceiling, the object lands in a private prefix with no ACL, and both the caller and the
 * event have hourly quotas. No origin check: presigning writes nothing on anyone's behalf, and a
 * public event page is exactly where this is called from.
 */
export async function POST(request: Request) {
  const t = await getTranslations("event");
  if (!storageConfigured) return NextResponse.json({ error: t("errors.uploadsNotConfigured") }, { status: 503 });

  const parsed = input.safeParse(await readJsonBody(request, 1_024).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t("errors.chooseFile") }, { status: 400 });
  const plan = planRegistrationUpload(parsed.data);
  if (!plan.ok) return NextResponse.json({ error: planErrorKey[plan.error] ? t(planErrorKey[plan.error]!) : plan.error }, { status: plan.status });

  const [event] = await db.select({ id: events.id, status: events.status }).from(events).where(eq(events.id, plan.eventId)).limit(1);
  if (!event || event.status !== "published") return NextResponse.json({ error: t("errors.notOpenForRegistration") }, { status: 404 });
  const [field] = await db.select({ id: registrationFields.id }).from(registrationFields)
    .where(and(eq(registrationFields.eventId, event.id), eq(registrationFields.type, "file"))).limit(1);
  if (!field) return NextResponse.json({ error: t("errors.noFileField") }, { status: 404 });

  const address = clientAddress(request);
  const identityOk = await consumeSharedRateLimit(
    address ? "reg-upload:client" : "reg-upload:global",
    address ?? "unattributed",
    address ? REGISTRATION_UPLOAD_CLIENT_LIMIT : REGISTRATION_UPLOAD_GLOBAL_LIMIT,
    REGISTRATION_UPLOAD_WINDOW_MS,
  );
  const eventOk = await consumeSharedRateLimit("reg-upload:event", event.id, REGISTRATION_UPLOAD_EVENT_LIMIT, REGISTRATION_UPLOAD_WINDOW_MS);
  if (!identityOk || !eventOk) return NextResponse.json({ error: t("errors.tooManyUploads") }, { status: 429 });

  try {
    const presigned = await presignRegistrationUpload(event.id, plan.contentType);
    // remembered so the sweep can delete it if no registration ever claims it
    await trackRegistrationUpload(db, { eventId: event.id, key: presigned.key }).catch((e) => captureError("uploads.track", e, { eventId: event.id }));
    return NextResponse.json({ ...presigned, ...capability }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    captureError("uploads.registration.presign", error, { eventId: event.id });
    return NextResponse.json({ error: t("errors.storageUnavailable") }, { status: 503 });
  }
}
