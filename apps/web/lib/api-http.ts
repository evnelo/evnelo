import { createHash } from "node:crypto";
import type { ApiRateLimit } from "@ot/core/services";

export const MAX_API_BODY_BYTES = 256 * 1024;
export const PUBLIC_API_RATE_LIMIT = 60;
export const PUBLIC_API_GLOBAL_RATE_LIMIT = 3_000;

export class ApiHttpError extends Error {
  constructor(
    public readonly status: 400 | 413 | 415,
    public readonly code: "invalid_json" | "payload_too_large" | "unsupported_media_type",
    message: string,
  ) {
    super(message);
    this.name = "ApiHttpError";
  }
}

function isJsonMediaType(value: string | null): boolean {
  const mediaType = value?.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" || Boolean(mediaType?.startsWith("application/") && mediaType.endsWith("+json"));
}

export async function readJsonBody(request: Request, maxBytes = MAX_API_BODY_BYTES): Promise<unknown> {
  if (!isJsonMediaType(request.headers.get("content-type"))) {
    throw new ApiHttpError(415, "unsupported_media_type", "Content-Type must be application/json.");
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiHttpError(413, "payload_too_large", `Request bodies are limited to ${maxBytes} bytes.`);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new ApiHttpError(400, "invalid_json", "A JSON request body is required.");

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ApiHttpError(413, "payload_too_large", `Request bodies are limited to ${maxBytes} bytes.`);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ApiHttpError(400, "invalid_json", "The request body must contain valid JSON.");
  }
}

export type TrustedProxyHeader = "cf-connecting-ip" | "x-real-ip" | "x-forwarded-for";

function configuredTrustedProxyHeader(): TrustedProxyHeader | undefined {
  const value = process.env.API_TRUSTED_PROXY_HEADER?.trim().toLowerCase();
  if (value === "cf-connecting-ip" || value === "x-real-ip" || value === "x-forwarded-for") return value;
  return undefined;
}

function clientAddress(request: Request, trustedProxyHeader?: TrustedProxyHeader): string {
  if (!trustedProxyHeader) return "unattributed";
  const value = request.headers.get(trustedProxyHeader)?.trim();
  if (!value) return "unattributed";
  return trustedProxyHeader === "x-forwarded-for" ? value.split(",", 1)[0]!.trim() || "unattributed" : value;
}

function hashedRateLimitBucket(identity: string): string {
  const digest = createHash("sha256").update(identity).digest("base64url");
  return `p${digest.slice(0, 25)}`;
}

export const PUBLIC_API_GLOBAL_BUCKET = hashedRateLimitBucket("openticket:public-api:global");

export function publicRateLimitBucket(request: Request, trustedProxyHeader = configuredTrustedProxyHeader()): string {
  return hashedRateLimitBucket(`openticket:public-api:client:${clientAddress(request, trustedProxyHeader)}`);
}

export function rateLimitHeaders(rateLimit: ApiRateLimit): HeadersInit {
  return {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
  };
}

export function apiJson(body: unknown, init: ResponseInit = {}, rateLimit?: ApiRateLimit): Response {
  const headers = new Headers(init.headers);
  if (rateLimit) {
    for (const [name, value] of Object.entries(rateLimitHeaders(rateLimit))) headers.set(name, String(value));
  }
  return Response.json(body, { ...init, headers });
}
