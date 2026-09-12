import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; vi.resetModules(); });

async function headersFor(path: string, env: Record<string, string>) {
  Object.assign(process.env, env);
  vi.resetModules();
  const { middleware } = await import("./middleware");
  return middleware(new NextRequest(`https://evnelo.test${path}`)).headers;
}

describe("security header middleware", () => {
  it("builds the policy from the runtime environment, not the build", async () => {
    const h = await headersFor("/login", { NODE_ENV: "production", APP_URL: "https://evnelo.test", CAPTCHA_PROVIDER: "turnstile", S3_BUCKET: "evnelo-prod", S3_REGION: "us-east-1" });
    expect(h.get("Content-Security-Policy")).toContain("https://challenges.cloudflare.com");
    expect(h.get("Content-Security-Policy")).toContain("https://evnelo-prod.s3.us-east-1.amazonaws.com");
    expect(h.get("Strict-Transport-Security")).toContain("max-age=");
    expect(h.get("X-Frame-Options")).toBe("DENY");
  });

  it("omits what is not configured", async () => {
    const h = await headersFor("/", { NODE_ENV: "production", APP_URL: "http://localhost:3000", CAPTCHA_PROVIDER: "", S3_BUCKET: "", S3_REGION: "" });
    expect(h.get("Content-Security-Policy")).not.toContain("cloudflare");
    expect(h.get("Strict-Transport-Security")).toBeNull();
  });

  it("gives the API reference the Scalar policy", async () => {
    const h = await headersFor("/api/v1/docs", { NODE_ENV: "production", APP_URL: "https://evnelo.test" });
    expect(h.get("Content-Security-Policy")).toContain("https://cdn.jsdelivr.net");
    expect(h.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
