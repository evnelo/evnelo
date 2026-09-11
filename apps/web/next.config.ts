import path from "node:path";
import type { NextConfig } from "next";

// Next only reads apps/web/.env*. Load the repo-root .env too so `pnpm dev` from the
// monorepo root works with a single .env file. Already-set variables are never overridden.
try {
  process.loadEnvFile(path.resolve(__dirname, "../../.env"));
} catch {
  // no root .env (e.g. Docker/CI inject env directly)
}

// Tailscale Serve and some reverse proxies forward requests to localhost. Auth.js otherwise
// derives localhost callback cookies and redirects even though APP_URL is public.
if (!process.env.AUTH_URL && process.env.APP_URL) {
  process.env.AUTH_URL = process.env.APP_URL;
}

const config: NextConfig = {
  transpilePackages: ["@ot/core", "@ot/db"],
  // self-contained server for the Docker image; the monorepo root is the tracing root so workspace packages are included
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  // fonts for generated Open Graph images are read from disk at request time
  outputFileTracingIncludes: { "/**/opengraph-image": ["./assets/fonts/**"], "/opengraph-image": ["./assets/fonts/**"] },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  serverExternalPackages: ["mysql2", "@sentry/nextjs"],
  async headers() {
    // required by absolute path: Next compiles this file in isolation and drops static imports of local modules
    const { apiDocsContentSecurityPolicy, securityHeaders, securityHeadersFromProcessEnv } =
      require(path.resolve(__dirname, "lib/security-headers.js")) as typeof import("./lib/security-headers.js");
    const base = securityHeaders(securityHeadersFromProcessEnv());
    return [
      { source: "/(.*)", headers: base },
      // later entries override earlier ones for the same key: the API reference needs the Scalar CDN
      { source: "/api/v1/docs", headers: [{ key: "Content-Security-Policy", value: apiDocsContentSecurityPolicy() }] },
    ];
  },
};

export default config;
