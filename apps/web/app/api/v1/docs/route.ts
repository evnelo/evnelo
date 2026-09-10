import { randomBytes } from "node:crypto";
import { ApiReference } from "@scalar/nextjs-api-reference";
import { SCALAR_CDN_URL, SCALAR_INTEGRITY } from "./scalar";

export const dynamic = "force-dynamic";

export async function GET() {
  const nonce = randomBytes(18).toString("base64");
  const scalarResponse = ApiReference({
    cdn: SCALAR_CDN_URL,
    nonce,
    pageTitle: "OpenTicket API Reference",
    theme: "default",
    url: "/api/v1/openapi.json",
  })();
  const html = (await scalarResponse.text()).replace(
    `src="${SCALAR_CDN_URL}"`,
    `src="${SCALAR_CDN_URL}" integrity="${SCALAR_INTEGRITY}" crossorigin="anonymous"`,
  );

  return new Response(html, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": [
        "default-src 'self'",
        `script-src 'nonce-${nonce}' 'strict-dynamic'`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https:",
        "connect-src 'self' https:",
        "worker-src 'self' blob:",
        "frame-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ].join("; "),
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
