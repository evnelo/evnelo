import { NextResponse, type NextRequest } from "next/server";
import { apiDocsContentSecurityPolicy, securityHeaders, securityHeadersFromProcessEnv } from "@/lib/security-headers.js";

/**
 * Security headers on every response, computed from the environment the server actually runs with.
 * They used to come from next.config `headers()`, but that is evaluated once at build time, so a
 * Docker image built without APP_URL, S3_* or CAPTCHA_* shipped without HSTS, the upload origin or
 * the bot-check origins in its CSP. The environment does not change while the process lives, so the
 * header list is built once per process.
 */
export const runtime = "nodejs";

let cached: { key: string; value: string }[] | null = null;
function baseHeaders() {
  return (cached ??= securityHeaders(securityHeadersFromProcessEnv()));
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  for (const { key, value } of baseHeaders()) response.headers.set(key, value);
  // the interactive API reference loads Scalar from a CDN and needs its own policy
  if (request.nextUrl.pathname === "/api/v1/docs") response.headers.set("Content-Security-Policy", apiDocsContentSecurityPolicy());
  return response;
}

export const config = {
  // hashed static assets do not need the headers; everything else (pages, API, images, files) does
  matcher: ["/((?!_next/static|_next/image).*)"],
};
