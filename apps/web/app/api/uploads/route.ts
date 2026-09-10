import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { events } from "@ot/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { uploadAccess } from "@/lib/upload-access";
import {
  MAX_IMAGE_BYTES,
  MAX_ORGANIZATION_UPLOAD_BYTES,
  cleanupOrganizationUploads,
  hasTrustedRequestOrigin,
  organizationUploadBytes,
  processImageUpload,
  readBoundedRequestBody,
  uploadDirectory,
} from "@/lib/uploads";

export const runtime = "nodejs";

function referencedUploadFilename(url: string | null, organizationId: string) {
  if (!url) return null;
  try {
    const filename = new URL(url).pathname.split("/").pop() ?? "";
    return filename.startsWith(`${organizationId}-`) ? filename : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const expectedOrigin = new URL(env.APP_URL).origin;
  if (!hasTrustedRequestOrigin(request, expectedOrigin)) return NextResponse.json({ error: "Invalid upload origin." }, { status: 403 });
  const access = await uploadAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!(await consumeSharedRateLimit("upload", access.user.id, 20, 60 * 60_000))) {
    return NextResponse.json({ error: "Upload limit reached. Try again later." }, { status: 429 });
  }
  let boundedBody: Uint8Array;
  try {
    boundedBody = await readBoundedRequestBody(request, MAX_IMAGE_BYTES + 256 * 1024);
  } catch {
    return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 413 });
  }

  let file: File;
  try {
    const body = boundedBody.buffer.slice(boundedBody.byteOffset, boundedBody.byteOffset + boundedBody.byteLength) as ArrayBuffer;
    const boundedRequest = new Request(request.url, { method: "POST", headers: request.headers, body });
    const formData = await boundedRequest.formData();
    const candidate = formData.get("file");
    if (!(candidate instanceof File)) throw new Error("Choose an image to upload.");
    file = candidate;
  } catch {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }

  let image: Buffer;
  try {
    image = await processImageUpload(file);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid image." }, { status: 422 });
  }

  try {
    const directory = uploadDirectory(env.UPLOAD_DIR);
    await mkdir(directory, { recursive: true });
    return await db.transaction(async (tx) => {
      const lockName = `openticket:upload:${access.org.id}`;
      const [lockRows] = await tx.execute(sql`SELECT GET_LOCK(${lockName}, 5) AS acquired`);
      if (Number(((lockRows as unknown) as Array<{ acquired: number | string }>)[0]?.acquired ?? 0) !== 1) throw new Error("Upload storage is busy.");
      try {
        const eventImages = await tx.select({ cover: events.coverImageUrl, logo: events.logoUrl }).from(events).where(eq(events.organizationId, access.org.id));
        const referenced = new Set(eventImages.flatMap((event) => [
          referencedUploadFilename(event.cover, access.org.id),
          referencedUploadFilename(event.logo, access.org.id),
        ]).filter((filename): filename is string => Boolean(filename)));
        await cleanupOrganizationUploads(directory, access.org.id, referenced, new Date(Date.now() - 24 * 60 * 60_000));
        const used = await organizationUploadBytes(directory, access.org.id);
        if (used + image.length > MAX_ORGANIZATION_UPLOAD_BYTES) {
          return NextResponse.json({ error: "Organization image storage is full. Remove unused images and try again." }, { status: 507 });
        }
        const filename = `${access.org.id}-${randomBytes(16).toString("hex")}.webp`;
        await writeFile(`${directory}/${filename}`, image, { flag: "wx" });
        return NextResponse.json({ url: `${env.APP_URL}/api/uploads/${filename}` }, { status: 201 });
      } finally {
        await tx.execute(sql`SELECT RELEASE_LOCK(${lockName})`);
      }
    });
  } catch (error) {
    console.error("[uploads] unable to store image", error);
    return NextResponse.json({ error: "The image could not be stored. Try again." }, { status: 500 });
  }
}
