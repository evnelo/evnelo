import { isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "@/i18n/locales";

/** Locale of an incoming request outside React (route handlers): the switcher cookie, then Accept-Language. */
export function requestLocale(request: Request): Locale {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  const chosen = match?.[1] ? decodeURIComponent(match[1]) : undefined;
  return isLocale(chosen) ? chosen : negotiateLocale(request.headers.get("accept-language"));
}
