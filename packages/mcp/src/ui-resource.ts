import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const cache = new Map<string, Promise<string>>();

/** Immutable per-instance bundle, no user state. Existing generated catalogues are never edited. */
export function eventCardsHtml(origin: string): Promise<string> {
  let html = cache.get(origin);
  if (!html) {
    html = bundle(origin);
    cache.set(origin, html);
    html.catch(() => cache.delete(origin));
  }
  return html;
}
async function bundle(origin: string) {
  let template: string;
  try { template = await readFile(new URL("./cards.js", import.meta.url), "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    template = await (await import("./ui-build.js")).buildEventCardsScript();
  }
  const script = template.replaceAll(JSON.stringify("__EVNELO_PUBLIC_ORIGIN__"), JSON.stringify(origin)).replace(/<\/script/gi, "<\\/script");
  const css = `:root{color-scheme:light;--bg:#f7f7f2;--ink:#14151a;--border:#e9eae4}html[data-theme=dark]{color-scheme:dark;--bg:#14151a;--ink:#f7f7f2;--border:#3a3b40}*{box-sizing:border-box}body{margin:0;padding:20px;font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--ink)}h1{font-size:24px;line-height:1.1;letter-spacing:-.03em;margin:0 0 20px}#cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px}article{border:1px solid var(--border);border-radius:16px;padding:20px;overflow-wrap:anywhere;min-width:0}h2{font-size:20px;line-height:1.25;margin:8px 0 16px}p{margin:8px 0}article>p:first-child{font-size:14px}time{display:block;font-size:15px}button{font:600 16px/1.5 system-ui;min-height:44px;width:100%;border:0;border-radius:12px;padding:10px 16px;margin-block-start:16px;background:#c9f269;color:#14151a;cursor:pointer}button:disabled{opacity:.6;cursor:wait}button:focus-visible{outline:3px solid var(--ink);outline-offset:3px}[role=alert]{border-inline-start:3px solid #b42318;padding-inline-start:12px}#status:empty{display:none}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;
  const hash = (value: string) => createHash("sha256").update(value).digest("base64");
  const policy = `default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(css)}'; connect-src 'none'; img-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><title>Evnelo</title><style>${css}</style></head><body><h1></h1><p id="status" role="status" aria-live="polite"></p><main id="cards" aria-label="Evnelo"></main><script type="module">${script}</script></body></html>`;
}
