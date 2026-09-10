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
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  serverExternalPackages: ["mysql2"],
};

export default config;
