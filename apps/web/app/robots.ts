import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/** Per request: the image is built without APP_URL, and a prerendered file would point crawlers at localhost. */
export const dynamic = "force-dynamic";

/**
 * Everything public is crawlable. The blocked prefixes are either private (the dashboard, tickets,
 * orders, and the token links behind /i, /w, /invite and /unsubscribe), machine-only (the API), or
 * development aids. Unlisted and private event pages carry their own `noindex` from `robotsFor`,
 * which is what actually keeps them out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api", "/t/", "/i/", "/w/", "/orders/", "/unsubscribe/", "/login", "/onboarding", "/invite", "/dev"],
    }],
    sitemap: `${env.APP_URL}/sitemap.xml`,
  };
}
