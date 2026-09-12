import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isLocale, LOCALE_COOKIE, negotiateLocale } from "./locales";
import { loadMessages } from "./messages";

/**
 * Locale per request, no URL prefixes: an explicit choice from the switcher (cookie) wins, then
 * the browser's Accept-Language, then English. URLs stay the same in every language.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const chosen = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(chosen) ? chosen : negotiateLocale((await headers()).get("accept-language"));
  return { locale, messages: await loadMessages(locale), timeZone: "UTC" };
});
