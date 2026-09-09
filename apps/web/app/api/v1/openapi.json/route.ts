import { NextResponse } from "next/server";
import { openApiDocument } from "@/lib/openapi";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(openApiDocument, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
