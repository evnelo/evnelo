import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { uploadDirectory, uploadedImagePath } from "../../../../lib/uploads";

export const runtime = "nodejs";

type Params = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { filename } = await params;
  try {
    const filePath = uploadedImagePath(filename, uploadDirectory(process.env.UPLOAD_DIR));
    if (!filePath) return new NextResponse("Not found", { status: 404 });
    const body = await readFile(filePath);
    return new NextResponse(body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(body.length),
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Type": "image/webp",
        ETag: `"${filename.slice(27, 59)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
