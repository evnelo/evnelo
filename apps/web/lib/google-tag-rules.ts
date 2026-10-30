/**
 * What the Google tag (GA4 + Google Ads) may see. Browser-safe and pure, so the rules are unit tested.
 *
 * The tag runs on marketing pages only. Event pages belong to hosts and their attendees, and ticket,
 * order, invite, waitlist and unsubscribe URLs carry bearer tokens, so none of them is ever reported.
 * Query strings are reduced to campaign parameters and Discover facets: the login page carries the
 * visitor's email in `?email=` after a failed attempt, and Google's terms forbid sending PII.
 */

const TRACKED_PATHS = ["/", "/discover", "/login", "/legal"];

export function googleTagAllowed(pathname: string): boolean {
  return TRACKED_PATHS.includes(pathname) || pathname.startsWith("/legal/");
}

const KEPT_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "gclid", "gbraid", "wbraid", "gad_source", "gad_campaignid",
  "city", "tag", "price", "format",
]);

/** `href` with only campaign parameters and Discover facets left in its query, and no fragment. */
export function sanitizedLocation(href: string): string {
  const url = new URL(href);
  const kept = new URLSearchParams();
  url.searchParams.forEach((value, key) => { if (KEPT_PARAMS.has(key)) kept.append(key, value); });
  const query = kept.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}

/** The referrer as Google may see it: same-origin referrers only when they are tracked pages, external ones reduced to their origin. */
export function sanitizedReferrer(referrer: string, origin: string): string {
  if (!referrer) return "";
  let url: URL;
  try { url = new URL(referrer); } catch { return ""; }
  if (url.origin !== origin) return `${url.origin}/`;
  return googleTagAllowed(url.pathname) ? sanitizedLocation(referrer) : `${url.origin}/`;
}

/**
 * Consent Mode v2 defaults: storage denied in the EEA, the UK and Switzerland (Google sends cookieless
 * pings there and models the gaps), granted elsewhere. There is no banner, so these never change.
 */
export const CONSENT_DENIED_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
];
