/**
 * Pure helpers for the translation script.
 *
 * ICU message syntax must survive machine translation. Two things can go wrong:
 * a translator may drop or reorder `{name}` arguments, and — worse — it may reorder the pieces
 * of a `{count, plural, one {…} other {…}}` frame, which produces a message that no longer parses.
 *
 * So the structure is never sent to the translator at all. `segmentsOf` parses the message into a
 * tree and hands back only the human-readable runs of text; the caller translates those, and
 * `rebuild` puts the original frame back around them. Inside a run, `{arguments}` and `#` are
 * wrapped in `notranslate` spans (they may move within the sentence, which is what other word
 * orders need).
 *
 * `<tag>…</tag>` rich-text markers are left inline by default, because the engine's HTML mode
 * moves them with the words and that reads better. It does sometimes unbalance them when it
 * reverses a sentence for a right-to-left script, so `planMessage(msg, { splitTags: true })`
 * treats them as structure too; the script retries with that whenever a result fails validation.
 */
import { parse as parseIcu, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";

export type Token = { placeholder: string; original: string };

/**
 * Names that must come back exactly as they went in. Without this a translator will happily
 * render "Resend" as "send again" (it did, in Urdu) or spell "Evnelo" in the local script.
 * Longest first, so "Google Wallet" wins over "Google".
 */
export const DO_NOT_TRANSLATE = [
  "Apple Wallet", "Google Wallet", "Google Calendar", "Stripe Connect", "Next.js", "Node.js",
  "Evnelo", "InEvent", "Stripe", "Resend", "Vonage", "MySQL", "Apache", "Docker", "GitHub",
  "Cloudflare", "Turnstile", "reCAPTCHA", "PostHog", "CloudFront", "Zapier", "OpenAPI", "Scalar",
  "TypeScript", "JavaScript", "Drizzle", "Tailwind", "Photon", "Mapbox", "Telnyx", "Luma",
  "Eventbrite", "PostHog", "Slack", "Webhook", "webhook",
].sort((a, b) => b.length - a.length);

export function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v as Record<string, unknown>, key));
    else if (typeof v === "string") out[key] = v;
  }
  return out;
}

/** Rebuilds nesting from dotted keys, in the order of the English source so diffs stay readable. */
export function unflatten(flat: Record<string, string>, order: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = [...Object.keys(order).filter((k) => k in flat), ...Object.keys(flat).filter((k) => !(k in order))];
  for (const key of keys) {
    const parts = key.split(".");
    let node = out;
    for (const part of parts.slice(0, -1)) {
      node[part] = (node[part] as Record<string, unknown> | undefined) ?? {};
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1] ?? key] = flat[key];
  }
  return out;
}

export function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Index of the `}` matching the `{` at `start`, or -1. */
function closing(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

const PLURAL_LIKE = /^\s*([\w]+)\s*,\s*(plural|select|selectordinal)\s*,/;
/** A run worth translating has at least one letter; `{name}` or ` — ` on its own does not. */
const HAS_WORDS = /\p{L}/u;

type Node =
  | { kind: "run"; text: string }
  | { kind: "choice"; head: string; branches: { key: string; nodes: Node[] }[] }
  | { kind: "tag"; name: string; nodes: Node[] };

/** End index (exclusive) of the `</name>` that closes the `<name>` opening at `from`, or -1. */
function closingTag(text: string, name: string, from: number): number {
  const open = `<${name}>`;
  const close = `</${name}>`;
  let depth = 1;
  let i = from;
  while (i < text.length) {
    const nextOpen = text.indexOf(open, i);
    const nextClose = text.indexOf(close, i);
    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) { depth++; i = nextOpen + open.length; continue; }
    depth--;
    if (depth === 0) return nextClose;
    i = nextClose + close.length;
  }
  return -1;
}

/** Splits a message into translatable runs and the frames that hold them. */
function parse(message: string, splitTags = false): Node[] {
  const nodes: Node[] = [];
  let run = "";
  const flush = () => { if (run) { nodes.push({ kind: "run", text: run }); run = ""; } };
  let i = 0;
  while (i < message.length) {
    const ch = message[i];
    if (ch === "{") {
      const end = closing(message, i);
      if (end === -1) { run += message.slice(i); break; }
      const inner = message.slice(i + 1, end);
      const m = inner.match(PLURAL_LIKE);
      if (m) {
        flush();
        const head = inner.slice(0, m[0].length);
        let rest = inner.slice(m[0].length);
        const branches: { key: string; nodes: Node[] }[] = [];
        while (rest.trim()) {
          const bm = rest.match(/^\s*([^\s{]+)\s*\{/);
          if (!bm) break;
          const bodyStart = bm[0].length - 1;
          const bodyEnd = closing(rest, bodyStart);
          if (bodyEnd === -1) break;
          branches.push({ key: bm[1] ?? "other", nodes: parse(rest.slice(bodyStart + 1, bodyEnd), splitTags) });
          rest = rest.slice(bodyEnd + 1);
        }
        nodes.push({ kind: "choice", head, branches });
      } else {
        run += message.slice(i, end + 1); // a plain {argument}: part of the run, protected later
      }
      i = end + 1;
    } else if (splitTags && ch === "<" && /^<[a-zA-Z][\w-]*>/.test(message.slice(i))) {
      const open = message.slice(i, message.indexOf(">", i) + 1);
      const name = open.slice(1, -1);
      const bodyStart = i + open.length;
      const bodyEnd = closingTag(message, name, bodyStart);
      if (bodyEnd === -1) { run += ch; i++; continue; }
      flush();
      nodes.push({ kind: "tag", name, nodes: parse(message.slice(bodyStart, bodyEnd), true) });
      i = bodyEnd + name.length + 3;
    } else {
      run += ch;
      i++;
    }
  }
  flush();
  return nodes;
}

/** Wraps `{arguments}`, `#` and every protected name so the engine moves but never rewrites them. */
function protectRun(text: string): { text: string; tokens: Token[] } {
  const tokens: Token[] = [];
  const mark = (original: string) => {
    const placeholder = `__${tokens.length}__`;
    tokens.push({ placeholder, original });
    return `<span class="notranslate">${placeholder}</span>`;
  };
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "{") {
      const end = closing(text, i);
      if (end === -1) { out += text.slice(i); break; }
      out += mark(text.slice(i, end + 1));
      i = end + 1;
    } else if (ch === "#") {
      out += mark("#");
      i++;
    } else {
      const name = DO_NOT_TRANSLATE.find((n) => text.startsWith(n, i) && !/\w/.test(text[i - 1] ?? "") && !/\w/.test(text[i + n.length] ?? ""));
      if (name) { out += mark(name); i += name.length; }
      else { out += ch; i++; }
    }
  }
  return { text: out, tokens };
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };

function restoreRun(translated: string, tokens: Token[]): string {
  let out = translated.replace(/<span[^>]*>\s*(__\d+__)\s*<\/span>/g, (_, p) => String(p));
  for (const { placeholder, original } of tokens) out = out.split(placeholder).join(original);
  return out
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/ {2,}/g, " ")
    .replace(/(<[a-z][^>]*>) /gi, "$1").replace(/ (<\/[a-z]+>)/gi, "$1")
    .replace(/\s+([,.;:!?])/g, "$1");
}

export type Plan = {
  /** The runs to translate, in order. Empty when the message is only placeholders. */
  texts: string[];
  /** Rebuilds the message from the translated runs (same length and order as `texts`). */
  rebuild: (translated: string[]) => string;
};

/**
 * Prepares one message for translation: the text runs to send, and how to put the message back
 * together afterwards. Plural and select frames are rebuilt here, so the engine cannot break them.
 */
export function planMessage(message: string, { splitTags = false }: { splitTags?: boolean } = {}): Plan {
  const texts: string[] = [];
  const tokensFor: Token[][] = [];

  type Rebuilder = (translated: string[]) => string;
  const walk = (nodes: Node[]): Rebuilder => {
    const parts: Rebuilder[] = nodes.map((node) => {
      if (node.kind === "run") {
        const { text, tokens } = protectRun(node.text);
        // letters must be outside the placeholders: "{name}" is nothing to translate, "Hi {name}" is
        if (!HAS_WORDS.test(text.replace(/<span[^>]*>__\d+__<\/span>/g, ""))) return () => node.text;
        const index = texts.length;
        texts.push(text);
        tokensFor.push(tokens);
        const leading = node.text.match(/^\s*/)?.[0] ?? "";
        const trailing = node.text.match(/\s*$/)?.[0] ?? "";
        return (out) => leading + restoreRun(out[index] ?? "", tokensFor[index] ?? []).trim() + trailing;
      }
      if (node.kind === "tag") {
        const inner = walk(node.nodes);
        return (out) => `<${node.name}>${inner(out)}</${node.name}>`;
      }
      const branches = node.branches.map((b) => ({ key: b.key, rebuild: walk(b.nodes) }));
      return (out) => `{${node.head}${branches.map((b) => ` ${b.key} {${b.rebuild(out)}}`).join("")}}`;
    });
    return (out) => parts.map((p) => p(out)).join("");
  };

  const rebuild = walk(parse(message, splitTags));
  return { texts, rebuild };
}

/**
 * Is a translation safe to ship? It must parse as ICU and declare exactly the arguments its
 * English source does; anything else would throw when the page renders in that language.
 */
export function isFaithful(source: string, translated: string): boolean {
  const names = (message: string): string => {
    const found = new Set<string>();
    const visit = (elements: MessageFormatElement[]) => {
      for (const node of elements) {
        if ("value" in node && typeof node.value === "string" && node.type !== 0) found.add(node.value);
        if ("options" in node && node.options) for (const option of Object.values(node.options)) visit(option.value);
        if ("children" in node && node.children) visit(node.children);
      }
    };
    visit(parseIcu(message));
    return [...found].sort().join(",");
  };
  const tags = (message: string): string =>
    (message.match(/<\/?[a-zA-Z][\w-]*>/g) ?? []).slice().sort().join("");
  if (/__\d+__|notranslate/.test(translated)) return false; // a protected piece leaked through
  if (tags(source) !== tags(translated)) return false;       // a tag was dropped, added or unbalanced
  for (const name of DO_NOT_TRANSLATE) {
    const count = (m: string) => m.split(name).length - 1;
    if (count(source) !== count(translated)) return false;   // a protected name was rewritten
  }
  try {
    return names(source) === names(translated);
  } catch {
    return false;
  }
}
