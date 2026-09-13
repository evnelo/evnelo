/**
 * Keeps every language's message files in step with the English source using Google Translate.
 *
 *   pnpm --filter @evnelo/web translate            translate what is missing or changed
 *   pnpm --filter @evnelo/web translate --check    exit 1 if anything is missing or stale (CI)
 *   … --locales ar,fr --namespaces public --dry-run --force   (force: retranslate everything in scope)
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
import { flatten, unflatten, planMessage, isFaithful, batches } from "./translate-lib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const messagesDir = resolve(root, "messages");
const snapshotPath = resolve(messagesDir, ".translated.json");
const glossaryPath = resolve(messagesDir, "glossary.json");

try { process.loadEnvFile(resolve(root, "../../.env")); } catch { /* environment only */ }

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const check = flag("check");
const dryRun = flag("dry-run");
const force = flag("force");
const onlyLocales = opt("locales")?.split(",").map((s) => s.trim()).filter(Boolean);
const onlyNamespaces = opt("namespaces")?.split(",").map((s) => s.trim()).filter(Boolean);

type Flat = Record<string, string>;
type Glossary = Record<string, [string, string][]>;

/** Where English means a webhook event, the computing word is the right one: leave it alone. */
const TECHNICAL = /webhook/i;

/** Applies the locale's word corrections to a translated message. */
export function applyGlossary(glossary: Glossary, locale: string, source: string, translated: string): string {
  if (TECHNICAL.test(source)) return translated;
  let out = translated;
  for (const [wrong, right] of glossary[locale] ?? []) out = out.split(wrong).join(right);
  return out;
}
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
  const glossary = readJson<Glossary>(glossaryPath, {});
  const targets = LOCALES.filter((l) => l.code !== DEFAULT_LOCALE && (!onlyLocales || onlyLocales.includes(l.code)));
  const namespaces = NAMESPACES.filter((ns) => !onlyNamespaces || onlyNamespaces.includes(ns));
  let pending = 0;
  let stale = 0;
  const kept: string[] = []; // messages no attempt translated faithfully: left in English
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;

  for (const ns of namespaces) {
    const en = flatten(readJson<Record<string, unknown>>(resolve(messagesDir, DEFAULT_LOCALE, `${ns}.json`), {}));
    for (const locale of targets) {
      const id = `${locale.code}/${ns}`;
      const targetPath = resolve(messagesDir, locale.code, `${ns}.json`);
      const current = flatten(readJson<Record<string, unknown>>(targetPath, {}));
      const seen = snapshot[id] ?? {};
      const todo = Object.keys(en).filter((k) => force || !(k in current) || seen[k] !== en[k]);
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
      // One message can need several requests (a plural has one run per branch), so the runs of a
      // whole batch of keys are flattened into one list, sent together, then handed back per key.
      const translateKeys = async (keys: string[], splitTags: boolean) => {
        const done: Record<string, string> = {};
        for (const group of batches(keys, 60)) {
          const plans = group.map((k) => planMessage(source(k), { splitTags }));
          const runs = plans.flatMap((p) => p.texts);
          const out = runs.length ? await translateBatch(runs, locale.google, key) : [];
          let at = 0;
          group.forEach((k, i) => {
            const plan = plans[i]!;
            done[k] = plan.rebuild(out.slice(at, at + plan.texts.length));
            at += plan.texts.length;
          });
        }
        return done;
      };

      const first = await translateKeys(todo, false);
      // The engine can unbalance rich-text tags when it reverses a sentence; those get a second
      // pass with the tags rebuilt here instead, and anything still broken stays in English.
      const broken = todo.filter((k) => !isFaithful(source(k), first[k] ?? ""));
      const second = broken.length ? await translateKeys(broken, true) : {};
      for (const k of todo) {
        const candidate = broken.includes(k) ? second[k] ?? "" : first[k] ?? "";
        const corrected = applyGlossary(glossary, locale.code, source(k), candidate);
        if (isFaithful(source(k), corrected)) next[k] = corrected;
        else { next[k] = source(k); kept.push(`${id} ${k}`); }
      }
      writeJson(targetPath, unflatten(next, en));
      snapshot[id] = Object.fromEntries(Object.keys(en).map((k) => [k, source(k)]));
      console.log(`${id}: translated ${todo.length}${broken.length ? ` (${broken.length} retried)` : ""}, dropped ${removed.length}`);
    }
  }
  if (!check && !dryRun) writeJson(snapshotPath, snapshot);
  if (kept.length) console.warn(`\nLeft in English because no translation kept the message intact:\n  ${kept.join("\n  ")}`);
  if (check) {
    if (pending || stale) { console.error(`Translations out of date: ${pending} missing/changed, ${stale} stale. Run: pnpm --filter @evnelo/web translate`); process.exit(1); }
    console.log("Translations are up to date.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
