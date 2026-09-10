import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { uploadDirectory, uploadedImagePath } from "@/lib/uploads";

export const runtime = "nodejs";

type Params = { params: Promise<{ filename: string }> };

/** Public, immutable: filenames are random per upload, so the name is the ETag. */
export async function GET(request: Request, { params }: Params) {
  const { filename } = await params;
  const filePath = uploadedImagePath(filename, uploadDirectory(env.UPLOAD_DIR));
  if (!filePath) return new NextResponse("Not found", { status: 404 });
  const etag = `"${filename.replace(/\.webp$/, "")}"`;
  const headers = {
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  try {
    const body = await readFile(filePath);
    return new NextResponse(body, {
      headers: { ...headers, "Content-Disposition": `inline; filename="${filename}"`, "Content-Length": String(body.length), "Content-Type": "image/webp" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
