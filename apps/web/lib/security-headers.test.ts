import { describe, expect, it } from "vitest";
import { apiDocsContentSecurityPolicy, contentSecurityPolicy, securityHeaders, uploadOrigins } from "./security-headers";

describe("security headers", () => {
  it("allows Stripe scripts, frames and API calls and forbids framing", () => {
    const csp = contentSecurityPolicy({ nodeEnv: "production" });
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.js.stripe.com");
    expect(csp).toContain("frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com");
    expect(csp).toContain("connect-src 'self' https://api.stripe.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("relaxes eval and websockets for the dev server only", () => {
    const csp = contentSecurityPolicy({ nodeEnv: "development" });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws: wss:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("lets the browser post uploads to the configured bucket", () => {
    expect(uploadOrigins({ s3Bucket: "ot", s3Region: "eu-west-1" })).toEqual(["https://s3.eu-west-1.amazonaws.com", "https://ot.s3.eu-west-1.amazonaws.com"]);
    expect(uploadOrigins({ s3Bucket: "my.dotted", s3Region: "us-east-1" })).toEqual(["https://s3.us-east-1.amazonaws.com"]);
    expect(uploadOrigins({ s3Endpoint: "https://acct.r2.cloudflarestorage.com/", s3Bucket: "b", s3Region: "auto" })).toEqual(["https://acct.r2.cloudflarestorage.com"]);
    expect(uploadOrigins({})).toEqual([]);
    expect(contentSecurityPolicy({ nodeEnv: "production", s3Bucket: "ot", s3Region: "eu-west-1" })).toContain("https://ot.s3.eu-west-1.amazonaws.com");
  });

  it("sends HSTS only when the app is served over https", () => {
    const keys = (appUrl: string) => securityHeaders({ appUrl, nodeEnv: "production" }).map((h) => h.key);
    expect(keys("https://tickets.example.com")).toContain("Strict-Transport-Security");
    expect(keys("http://localhost:3000")).not.toContain("Strict-Transport-Security");
    expect(keys("https://tickets.example.com")).toEqual(expect.arrayContaining(["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]));
  });

  it("gives the API reference its own policy for the Scalar bundle", () => {
    expect(apiDocsContentSecurityPolicy()).toContain("https://cdn.jsdelivr.net");
    expect(apiDocsContentSecurityPolicy()).toContain("https://fonts.scalar.com");
    expect(apiDocsContentSecurityPolicy()).toContain("frame-ancestors 'none'");
  });
});
