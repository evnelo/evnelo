/**
 * Keeps every language's message files in step with the English source using Google Translate.
 *
 *   pnpm --filter @evnelo/web translate            translate what is missing or changed
 *   pnpm --filter @evnelo/web translate --check    exit 1 if anything is missing or stale (CI)
 *   … --locales ar,fr --namespaces public --dry-run
 *
 * English (messages/en/*.json) is the source of truth. For every other locale the script
 * translates keys that are absent from the target file or whose English text changed since they
 * were last translated (tracked in messages/.translated.json, committed alongside). ICU
 * placeholders such as {name}, plural/select branches and <tag>…</tag> markup survive translation:
 * the script protects them and translates only the human text in between. Needs
 * GOOGLE_TRANSLATE_API_KEY (root .env or the environment).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LOCALE, LOCALES, NAMESPACES, type Locale, type Namespace } from "../i18n/locales";
import { flatten, unflatten, protectMessage, restoreMessage, batches } from "./translate-lib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const messagesDir = resolve(root, "messages");
const snapshotPath = resolve(messagesDir, ".translated.json");

try { process.loadEnvFile(resolve(root, "../../.env")); } catch { /* environment only */ }

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const check = flag("check");
const dryRun = flag("dry-run");
const onlyLocales = opt("locales")?.split(",").map((s) => s.trim()).filter(Boolean);
const onlyNamespaces = opt("namespaces")?.split(",").map((s) => s.trim()).filter(Boolean);

type Flat = Record<string, string>;
type Snapshot = Record<string, Flat>; // "{locale}/{namespace}" → key → English text when translated

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}
function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

async function translateBatch(texts: string[], target: string, key: string): Promise<string[]> {
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: texts, source: "en", target, format: "html" }),
  });
  if (!res.ok) throw new Error(`Google Translate ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { data: { translations: { translatedText: string }[] } };
  return json.data.translations.map((t) => t.translatedText);
}

async function main() {
  const snapshot = readJson<Snapshot>(snapshotPath, {});
  const targets = LOCALES.filter((l) => l.code !== DEFAULT_LOCALE && (!onlyLocales || onlyLocales.includes(l.code)));
  const namespaces = NAMESPACES.filter((ns) => !onlyNamespaces || onlyNamespaces.includes(ns));
  let pending = 0;
  let stale = 0;
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;

  for (const ns of namespaces) {
    const en = flatten(readJson<Record<string, unknown>>(resolve(messagesDir, DEFAULT_LOCALE, `${ns}.json`), {}));
    for (const locale of targets) {
      const id = `${locale.code}/${ns}`;
      const targetPath = resolve(messagesDir, locale.code, `${ns}.json`);
      const current = flatten(readJson<Record<string, unknown>>(targetPath, {}));
      const seen = snapshot[id] ?? {};
      const todo = Object.keys(en).filter((k) => !(k in current) || seen[k] !== en[k]);
      const source = (k: string) => en[k] ?? "";
      const removed = Object.keys(current).filter((k) => !(k in en));
      if (todo.length === 0 && removed.length === 0) continue;
      pending += todo.length;
      stale += removed.length;
      if (check || dryRun) {
        console.log(`${id}: ${todo.length} to translate, ${removed.length} to drop`);
        continue;
      }
      if (!key) throw new Error("GOOGLE_TRANSLATE_API_KEY is not set (root .env or environment).");
      const next: Flat = { ...current };
      for (const k of removed) delete next[k];
      for (const group of batches(todo, 100)) {
        const protectedTexts = group.map((k) => protectMessage(source(k)));
        const translated = await translateBatch(protectedTexts.map((p) => p.text), locale.google, key);
        group.forEach((k, i) => { next[k] = restoreMessage(translated[i] ?? "", protectedTexts[i]?.tokens ?? []); });
      }
      writeJson(targetPath, unflatten(next, en));
      snapshot[id] = Object.fromEntries(Object.keys(en).map((k) => [k, source(k)]));
      console.log(`${id}: translated ${todo.length}, dropped ${removed.length}`);
    }
  }
  if (!check && !dryRun) writeJson(snapshotPath, snapshot);
  if (check) {
    if (pending || stale) { console.error(`Translations out of date: ${pending} missing/changed, ${stale} stale. Run: pnpm --filter @evnelo/web translate`); process.exit(1); }
    console.log("Translations are up to date.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
