import { DEFAULT_LOCALE, NAMESPACES, type Locale, type Namespace } from "./locales";

type Messages = Record<string, unknown>;

async function loadNamespace(locale: Locale, ns: Namespace): Promise<Messages> {
  try {
    return (await import(`../messages/${locale}/${ns}.json`)).default as Messages;
  } catch {
    return {};
  }
}

/** Target over base, recursively, so a locale missing a key shows English instead of the key. */
export function mergeMessages(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object" && !Array.isArray(b)
      ? mergeMessages(b as Messages, v as Messages)
      : v;
  }
  return out;
}

/** All namespaces for a locale, each backed by English for anything not translated yet. */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const out: Messages = {};
  for (const ns of NAMESPACES) {
    const en = await loadNamespace(DEFAULT_LOCALE, ns);
    out[ns] = locale === DEFAULT_LOCALE ? en : mergeMessages(en, await loadNamespace(locale, ns));
  }
  return out;
}
