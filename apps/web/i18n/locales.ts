/**
 * The twenty languages Evnelo ships in: the world's most spoken ones, each with the code Google
 * Translate expects and the name shown in the switcher (written in the language itself).
 * `dir` marks right-to-left scripts; the root layout sets `<html dir>` from it and the styles use
 * logical properties (ms-/me-/ps-/pe-/start/end) so the layout mirrors on its own.
 */
export const LOCALES = [
  { code: "en", name: "English", dir: "ltr", google: "en" },
  { code: "zh-CN", name: "中文（简体）", dir: "ltr", google: "zh-CN" },
  { code: "hi", name: "हिन्दी", dir: "ltr", google: "hi" },
  { code: "es", name: "Español", dir: "ltr", google: "es" },
  { code: "fr", name: "Français", dir: "ltr", google: "fr" },
  { code: "ar", name: "العربية", dir: "rtl", google: "ar" },
  { code: "bn", name: "বাংলা", dir: "ltr", google: "bn" },
  { code: "pt-BR", name: "Português", dir: "ltr", google: "pt" },
  { code: "ru", name: "Русский", dir: "ltr", google: "ru" },
  { code: "ur", name: "اردو", dir: "rtl", google: "ur" },
  { code: "id", name: "Bahasa Indonesia", dir: "ltr", google: "id" },
  { code: "de", name: "Deutsch", dir: "ltr", google: "de" },
  { code: "ja", name: "日本語", dir: "ltr", google: "ja" },
  { code: "mr", name: "मराठी", dir: "ltr", google: "mr" },
  { code: "te", name: "తెలుగు", dir: "ltr", google: "te" },
  { code: "tr", name: "Türkçe", dir: "ltr", google: "tr" },
  { code: "ta", name: "தமிழ்", dir: "ltr", google: "ta" },
  { code: "vi", name: "Tiếng Việt", dir: "ltr", google: "vi" },
  { code: "ko", name: "한국어", dir: "ltr", google: "ko" },
  { code: "it", name: "Italiano", dir: "ltr", google: "it" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_CODES = LOCALES.map((l) => l.code) as readonly Locale[];
/** Cookie that remembers an explicit choice from the switcher; absent means "follow the browser". */
export const LOCALE_COOKIE = "ev_locale";
/** Message files under messages/{locale}/; the translation script keeps every locale in step with English. */
export const NAMESPACES = ["common", "public", "auth", "event", "dashboard", "manage", "emails"] as const;
export type Namespace = (typeof NAMESPACES)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALE_CODES as readonly string[]).includes(value);
}

export function localeInfo(locale: Locale) {
  return LOCALES.find((l) => l.code === locale) ?? LOCALES[0];
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return localeInfo(locale).dir;
}

/**
 * Best supported locale for an Accept-Language header: exact tag first, then language prefix
 * (`pt` → pt-BR, `zh` → zh-CN), in the order the browser prefers. Falls back to English.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const wanted = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((w) => w.tag && w.tag !== "*")
    .sort((a, b) => b.q - a.q);
  const lower = LOCALE_CODES.map((c) => ({ code: c, lower: c.toLowerCase(), lang: c.toLowerCase().split("-")[0] }));
  for (const { tag } of wanted) {
    const exact = lower.find((l) => l.lower === tag);
    if (exact) return exact.code;
    const lang = tag.split("-")[0] ?? tag;
    const byLang = lower.find((l) => l.lang === lang);
    if (byLang) return byLang.code;
  }
  return DEFAULT_LOCALE;
}
