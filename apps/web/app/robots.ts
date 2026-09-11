import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * Everything public is crawlable. The blocked prefixes are either private (the dashboard, tickets,
 * and the token links behind /i, /w and /invite), machine-only (the API), or development aids.
 * Unlisted and private event pages carry their own `noindex` from `robotsFor`, which is what
 * actually keeps them out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api", "/t/", "/i/", "/w/", "/login", "/onboarding", "/invite", "/dev"],
    }],
    sitemap: `${env.APP_URL}/sitemap.xml`,
    host: env.APP_URL,
  };
}
