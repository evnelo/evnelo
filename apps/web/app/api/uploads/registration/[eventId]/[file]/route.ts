import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireEvent } from "@/lib/dashboard";
import { captureError } from "@/lib/observability";
import { REGISTRATION_DOWNLOAD_EXPIRY_SECONDS } from "@/lib/registration-uploads";
import { presignRegistrationDownload, registrationUploadPrefix, storageConfigured, verifyRegistrationFile } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * GET /api/uploads/registration/{eventId}/{file} → the only way to read a registration file answer.
 *
 * Answers store a private object key, so membership in the owning organization is re-checked on
 * every click (`requireEvent` 404s for anyone else) and the redirect target expires in two minutes.
 * The key is rebuilt from this server's own prefix, so nothing in the URL can point elsewhere.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string; file: string }> }) {
  const [t, tc] = await Promise.all([getTranslations("event"), getTranslations("common")]);
  if (!storageConfigured) return new NextResponse(tc("errors.notFound"), { status: 404 });
  const { eventId, file } = await params;
  const { event } = await requireEvent(eventId, "manage_attendees");

  const verified = await verifyRegistrationFile(`${registrationUploadPrefix(event.id)}${file}`, event.id);
  if (!verified) return new NextResponse(tc("errors.notFound"), { status: 404 });

  try {
    const url = await presignRegistrationDownload(verified.key, {
      filename: `${event.slug}-${verified.name.slice(0, 8)}.${verified.extension}`,
      expiresIn: REGISTRATION_DOWNLOAD_EXPIRY_SECONDS,
    });
    return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "private, no-store", "referrer-policy": "no-referrer" } });
  } catch (error) {
    captureError("uploads.registration.download", error, { eventId: event.id });
    return new NextResponse(t("errors.storageUnavailable"), { status: 503 });
  }
}
