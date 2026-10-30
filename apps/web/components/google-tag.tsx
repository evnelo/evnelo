"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { CONSENT_DENIED_REGIONS, googleTagAllowed, sanitizedLocation, sanitizedReferrer } from "@/lib/google-tag-rules";

type GtagWindow = { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } & Record<`ga-disable-${string}`, boolean>;
const gtagWindow = () => window as unknown as GtagWindow;

function gtag(..._args: unknown[]) {
  const w = gtagWindow();
  w.dataLayer ??= [];
  // gtag.js only accepts the `arguments` object itself, not an array copy
  // eslint-disable-next-line prefer-rest-params
  w.dataLayer.push(arguments);
}

let initialized = false;
// per page load, so a re-run effect (React's dev double-invoke, a re-render) never reports a hit twice
let lastPageView = "";
let signupSent = false;

/**
 * Queues consent defaults and the destinations, once per page load; gtag.js replays the queue when it
 * arrives. Automatic page views are off: every hit is sent by hand with a sanitized location.
 */
function init(ids: string[]) {
  if (initialized) return;
  initialized = true;
  const w = gtagWindow();
  w.gtag ??= gtag;
  const denied = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" };
  gtag("consent", "default", { ...denied, region: CONSENT_DENIED_REGIONS });
  // Global Privacy Control is an opt-out of ad sharing under US state laws: analytics stays, ads storage does not
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  const ads = gpc ? "denied" : "granted";
  gtag("consent", "default", { ad_storage: ads, ad_user_data: ads, ad_personalization: ads, analytics_storage: "granted" });
  gtag("set", "ads_data_redaction", true);
  gtag("set", { page_location: sanitizedLocation(window.location.href), page_referrer: sanitizedReferrer(document.referrer, window.location.origin) });
  gtag("js", new Date());
  for (const id of ids) gtag("config", id, { send_page_view: false });
}

function setDisabled(ids: string[], disabled: boolean) {
  const w = gtagWindow();
  for (const id of ids) w[`ga-disable-${id}`] = disabled;
}

function GtagScript({ id }: { id: string }) {
  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`} strategy="afterInteractive" />;
}

/**
 * GA4 + Google Ads on the marketing pages (`googleTagAllowed`), mounted once in the public layout. It
 * loads on the first tracked page; on any other page every destination is switched off with Google's
 * `ga-disable-{id}` flag, so a client-side navigation to an event or ticket page sends nothing.
 */
export function GoogleTag({ ids }: { ids: string[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const allowed = googleTagAllowed(pathname);
  const [loaded, setLoaded] = useState(false);
  const query = searchParams.toString();
  const key = ids.join(","); // a stable dependency; the array itself is rebuilt from the RSC payload

  useEffect(() => {
    const ids = key.split(",");
    if (!allowed) {
      setDisabled(ids, true);
      lastPageView = "";
      return;
    }
    init(ids);
    setDisabled(ids, false);
    setLoaded(true);
    const location = sanitizedLocation(window.location.href);
    if (location === lastPageView) return;
    lastPageView = location;
    gtag("set", { page_location: location });
    gtag("event", "page_view");
  }, [allowed, key, pathname, query]);

  return loaded && ids[0] ? <GtagScript id={ids[0]} /> : null;
}

/**
 * The sign-up conversion: onboarding redirects to `/dashboard?welcome=1` after creating the organization.
 * Sends GA4's `sign_up` and the Ads conversion once, then drops the parameter so a reload does not count again.
 * Nothing else in the dashboard is reported.
 */
export function GoogleSignupConversion({ ids, sendTo }: { ids: string[]; sendTo: string | null }) {
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";
  const [loaded, setLoaded] = useState(false);
  const key = ids.join(",");

  useEffect(() => {
    if (!welcome || signupSent) return;
    signupSent = true;
    const ids = key.split(",");
    init(ids);
    // onboarding is not a tracked page, so the public tag left every destination switched off
    setDisabled(ids, false);
    gtag("set", { page_location: `${window.location.origin}/dashboard`, page_referrer: "" });
    const done = () => setDisabled(ids, true);
    if (sendTo) {
      gtag("event", "sign_up");
      gtag("event", "conversion", { send_to: sendTo, event_callback: done });
    } else gtag("event", "sign_up", { event_callback: done });
    setLoaded(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("welcome");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [welcome, key, sendTo]);

  return loaded && ids[0] ? <GtagScript id={ids[0]} /> : null;
}
