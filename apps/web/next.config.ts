import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withPostHogConfig } from "@posthog/nextjs-config";

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
  transpilePackages: ["@evnelo/core", "@evnelo/db"],
  // self-contained server for the Docker image; the monorepo root is the tracing root so workspace packages are included
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  // fonts for generated Open Graph images are read from disk at request time
  outputFileTracingIncludes: { "/**/opengraph-image": ["./assets/fonts/**"], "/opengraph-image": ["./assets/fonts/**"] },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  serverExternalPackages: ["mysql2"],
  // PostHog traffic goes through the app's own origin (ad blockers drop requests to *.posthog.com).
  // The rewrite targets are frozen at build time, like the browser token.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
    const assets = host.replace(".i.posthog.com", "-assets.i.posthog.com");
    return [
      { source: "/relay/static/:path*", destination: `${assets}/static/:path*` },
      { source: "/relay/:path*", destination: `${host}/:path*` },
    ];
  },
  // security headers are set per request in middleware.ts (a `headers()` entry here would be frozen at build time)
};

// locale + messages per request come from i18n/request.ts (cookie, then Accept-Language)
const withIntl = createNextIntlPlugin("./i18n/request.ts")(config);

// Source maps for PostHog error tracking are uploaded at build time when a personal API key and
// project id are provided (Docker build args); otherwise the build is unchanged.
export default process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID
  ? withPostHogConfig(withIntl, {
      personalApiKey: process.env.POSTHOG_API_KEY,
      projectId: process.env.POSTHOG_PROJECT_ID,
      host: (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com").replace(".i.posthog.com", ".posthog.com"),
      sourcemaps: { enabled: true, releaseName: "evnelo-web", releaseVersion: process.env.APP_VERSION, deleteAfterUpload: true },
    })
  : withIntl;
