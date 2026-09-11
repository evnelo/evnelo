import { NextResponse } from "next/server";
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

export const runtime = "nodejs";

const capability = { maxBytes: MAX_REGISTRATION_FILE_BYTES, contentTypes: REGISTRATION_FILE_CONTENT_TYPES };

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
  if (!storageConfigured) return NextResponse.json({ error: "File uploads aren't configured on this instance." }, { status: 503 });

  const parsed = input.safeParse(await readJsonBody(request, 1_024).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  const plan = planRegistrationUpload(parsed.data);
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: plan.status });

  const [event] = await db.select({ id: events.id, status: events.status }).from(events).where(eq(events.id, plan.eventId)).limit(1);
  if (!event || event.status !== "published") return NextResponse.json({ error: "This event isn't open for registration." }, { status: 404 });
  const [field] = await db.select({ id: registrationFields.id }).from(registrationFields)
    .where(and(eq(registrationFields.eventId, event.id), eq(registrationFields.type, "file"))).limit(1);
  if (!field) return NextResponse.json({ error: "This event doesn't ask for a file." }, { status: 404 });

  const address = clientAddress(request);
  const identityOk = await consumeSharedRateLimit(
    address ? "reg-upload:client" : "reg-upload:global",
    address ?? "unattributed",
    address ? REGISTRATION_UPLOAD_CLIENT_LIMIT : REGISTRATION_UPLOAD_GLOBAL_LIMIT,
    REGISTRATION_UPLOAD_WINDOW_MS,
  );
  const eventOk = await consumeSharedRateLimit("reg-upload:event", event.id, REGISTRATION_UPLOAD_EVENT_LIMIT, REGISTRATION_UPLOAD_WINDOW_MS);
  if (!identityOk || !eventOk) return NextResponse.json({ error: "Too many uploads right now. Try again later." }, { status: 429 });

  try {
    const presigned = await presignRegistrationUpload(event.id, plan.contentType);
    return NextResponse.json({ ...presigned, ...capability }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    captureError("uploads.registration.presign", error, { eventId: event.id });
    return NextResponse.json({ error: "File storage is unavailable right now." }, { status: 503 });
  }
}
