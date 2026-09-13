import { describe, expect, it } from "vitest";
import { apiDocsContentSecurityPolicy, captchaOrigins, contentSecurityPolicy, securityHeaders, uploadOrigins } from "./security-headers";

describe("security headers", () => {
  it("allows Stripe scripts, frames and API calls and forbids framing", () => {
    const csp = contentSecurityPolicy({ nodeEnv: "production" });
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.js.stripe.com");
    expect(csp).toContain("frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com");
    expect(csp).toContain("connect-src 'self' https://api.stripe.com");
    expect(csp).toContain("form-action 'self' https://accounts.google.com https://connect.stripe.com https://dashboard.stripe.com");
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

  it("admits the configured bot-check widget and nothing else", () => {
    expect(contentSecurityPolicy({ nodeEnv: "production" })).not.toContain("challenges.cloudflare.com");
    const turnstile = contentSecurityPolicy({ nodeEnv: "production", captchaProvider: "turnstile" });
    expect(turnstile).toContain("script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.js.stripe.com https://challenges.cloudflare.com");
    expect(turnstile).toContain("frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com");
    expect(turnstile).not.toContain("google.com/recaptcha");
    const recaptcha = contentSecurityPolicy({ nodeEnv: "production", captchaProvider: "recaptcha" });
    expect(recaptcha).toContain("https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/");
    expect(recaptcha).toContain("https://recaptcha.google.com/recaptcha/");
    expect(captchaOrigins({ captchaProvider: "bogus" })).toEqual({ scripts: [], frames: [] });
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
