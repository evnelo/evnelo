/**
 * Pure helpers for the translation script. ICU message syntax must survive machine translation:
 * `{name}` arguments, `{count, plural, one {…} other {…}}` branches (only the branch text is
 * translated, `#` and the keywords stay), and `<tag>…</tag>` rich-text markers. Each protected
 * piece becomes an HTML span Google is told not to translate, then is swapped back.
 */
export type Token = { placeholder: string; original: string };

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

/**
 * Replaces every non-translatable piece with `<span class="notranslate">…</span>` carrying a
 * numbered placeholder, recursing into plural/select branches so their text still gets translated.
 */
export function protectMessage(message: string): { text: string; tokens: Token[] } {
  const tokens: Token[] = [];
  const mark = (original: string) => {
    const placeholder = `__${tokens.length}__`;
    tokens.push({ placeholder, original });
    return `<span class="notranslate">${placeholder}</span>`;
  };
  const walk = (text: string): string => {
    let out = "";
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === "{") {
        const end = closing(text, i);
        if (end === -1) { out += text.slice(i); break; }
        const inner = text.slice(i + 1, end);
        const m = inner.match(PLURAL_LIKE);
        if (m) {
          // {count, plural, one {text} other {text}} → keep the frame, translate each branch body
          const head = inner.slice(0, m[0].length);
          let rest = inner.slice(m[0].length);
          let branches = "";
          while (rest.trim()) {
            const bm = rest.match(/^\s*([^\s{]+)\s*\{/);
            if (!bm) { branches += rest; break; }
            const bodyStart = bm[0].length - 1;
            const bodyEnd = closing(rest, bodyStart);
            if (bodyEnd === -1) { branches += rest; break; }
            branches += mark(` ${bm[1]} {`) + walk(rest.slice(bodyStart + 1, bodyEnd)) + mark("}");
            rest = rest.slice(bodyEnd + 1);
          }
          out += mark(`{${head}`) + branches + mark("}");
        } else {
          out += mark(`{${inner}}`);
        }
        i = end + 1;
      } else if (ch === "<") {
        const end = text.indexOf(">", i);
        if (end === -1) { out += text.slice(i); break; }
        out += mark(text.slice(i, end + 1));
        i = end + 1;
      } else if (ch === "#") {
        out += mark("#");
        i++;
      } else {
        out += ch;
        i++;
      }
    }
    return out;
  };
  return { text: walk(message), tokens };
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };

/** Puts the protected pieces back and undoes the HTML encoding Google applies in html mode. */
export function restoreMessage(translated: string, tokens: Token[]): string {
  let out = translated.replace(/<span class="notranslate">\s*(__\d+__)\s*<\/span>/g, (_, p) => p);
  for (const { placeholder, original } of tokens) out = out.split(placeholder).join(original);
  out = out.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  return out.replace(/\s+([,.;:!?])/g, "$1").trim();
}
