import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALE_CODES, NAMESPACES } from "./locales";
import { mergeMessages } from "./messages";

/**
 * The non-English message files are machine generated (scripts/translate.ts), so this is the guard
 * that keeps a bad translation from reaching the app: every message must still parse as ICU and
 * must still carry exactly the arguments its English source declares. A missing `{eventName}` or a
 * plural frame the translator reordered would throw at render time, in one language, in production.
 */
const dir = resolve(__dirname, "../messages");
const read = (locale: string, ns: string) => JSON.parse(readFileSync(resolve(dir, locale, `${ns}.json`), "utf8")) as Record<string, unknown>;
const exists = (locale: string) => readdirSync(dir).includes(locale);

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v as Record<string, unknown>, key));
    else if (typeof v === "string") out[key] = v;
  }
  return out;
}

/** Argument names a message needs, including the ones inside plural and select branches. */
function argumentsOf(elements: MessageFormatElement[], into = new Set<string>()): Set<string> {
  for (const node of elements) {
    if ("value" in node && typeof node.value === "string" && node.type !== 0) into.add(node.value);
    if ("options" in node && node.options) for (const option of Object.values(node.options)) argumentsOf(option.value, into);
    if ("children" in node && node.children) argumentsOf(node.children, into);
  }
  return into;
}

const targets = LOCALE_CODES.filter((l) => l !== DEFAULT_LOCALE && exists(l));

describe("message catalogue", () => {
  it("has an English file for every namespace", () => {
    for (const ns of NAMESPACES) expect(Object.keys(read(DEFAULT_LOCALE, ns)).length, `${ns} is empty`).toBeGreaterThan(0);
  });

  it.each(targets)("%s parses and keeps every argument English declares", (locale) => {
    const problems: string[] = [];
    for (const ns of NAMESPACES) {
      const en = flatten(read(DEFAULT_LOCALE, ns));
      let translated: Record<string, string>;
      try { translated = flatten(read(locale, ns)); } catch { continue; } // not generated yet
      for (const [key, value] of Object.entries(translated)) {
        const source = en[key];
        if (source === undefined) { problems.push(`${ns}.${key}: not in English any more`); continue; }
        let got: Set<string>;
        try { got = argumentsOf(parse(value)); } catch (e) { problems.push(`${ns}.${key}: does not parse — ${(e as Error).message}`); continue; }
        const want = argumentsOf(parse(source));
        const missing = [...want].filter((a) => !got.has(a));
        const extra = [...got].filter((a) => !want.has(a));
        if (missing.length || extra.length) problems.push(`${ns}.${key}: arguments differ (missing ${missing.join(",") || "-"}, extra ${extra.join(",") || "-"})`);
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it("falls back to English for anything a language has not translated", () => {
    expect(mergeMessages({ a: "en", nested: { keep: "en", over: "en" } }, { nested: { over: "fr" } }))
      .toEqual({ a: "en", nested: { keep: "en", over: "fr" } });
  });
});
