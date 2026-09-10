import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { uploadAccess } from "@/lib/upload-access";
import {
  ImageUploadError,
  MAX_IMAGE_BYTES,
  MAX_ORGANIZATION_UPLOAD_BYTES,
  hasTrustedRequestOrigin,
  organizationUploadBytes,
  processImageUpload,
  readBoundedRequestBody,
  uploadDirectory,
} from "@/lib/uploads";

export const runtime = "nodejs";

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
    return NextResponse.json({ error: error instanceof ImageUploadError ? error.message : "Invalid image." }, { status: 422 });
  }

  const directory = uploadDirectory(env.UPLOAD_DIR);
  try {
    await mkdir(directory, { recursive: true });
  } catch (error) {
    console.error("[uploads] UPLOAD_DIR is not writable", directory, error);
    return NextResponse.json({ error: "Image storage isn't writable on this instance. Ask the operator to check UPLOAD_DIR." }, { status: 503 });
  }
  try {
    return await db.transaction(async (tx) => {
      // per-organization quota under an advisory lock; the orphan sweep runs from the job loop, not here
      const lockName = `openticket:upload:${access.org.id}`;
      const [lockRows] = await tx.execute(sql`SELECT GET_LOCK(${lockName}, 5) AS acquired`);
      if (Number(((lockRows as unknown) as Array<{ acquired: number | string }>)[0]?.acquired ?? 0) !== 1) throw new Error("Upload storage is busy.");
      try {
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
