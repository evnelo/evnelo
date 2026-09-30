import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const catalogueRoot = new URL("../../../apps/web/messages/", import.meta.url);
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
  const catalogues: Record<string, unknown> = {};
  for (const directory of await readdir(catalogueRoot, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const read = async (name: string) => JSON.parse(await readFile(new URL(`${directory.name}/${name}.json`, catalogueRoot), "utf8"));
    const [common, pub, email] = await Promise.all([read("common"), read("public"), read("emails")]);
    catalogues[directory.name] = {
      title: pub.home.upcoming.title, loading: common.actions.loading, empty: pub.discover.empty.none.title,
      error: common.errors.generic, open: email.waitlistJoined.cta, free: common.labels.free,
      from: pub.discover.card.from, unknown: common.labels.unknown, format: pub.discover.format,
    };
  }
  const output = await build({
    entryPoints: [fileURLToPath(new URL("../ui/cards.ts", import.meta.url))],
    bundle: true, format: "esm", platform: "browser", target: "es2022", minify: true, write: false,
    define: { CATALOGUES: JSON.stringify(catalogues), INSTANCE_ORIGIN: JSON.stringify(origin) },
  });
  const script = output.outputFiles![0]!.text.replace(/<\/script/gi, "<\\/script");
  const css = `:root{color-scheme:light;--bg:#f7f7f2;--ink:#14151a;--border:#e9eae4}html[data-theme=dark]{color-scheme:dark;--bg:#14151a;--ink:#f7f7f2;--border:#3a3b40}*{box-sizing:border-box}body{margin:0;padding:20px;font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--ink)}h1{font-size:24px;line-height:1.1;letter-spacing:-.03em;margin:0 0 20px}#cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px}article{border:1px solid var(--border);border-radius:16px;padding:20px;overflow-wrap:anywhere;min-width:0}h2{font-size:20px;line-height:1.25;margin:8px 0 16px}p{margin:8px 0}article>p:first-child{font-size:14px}time{display:block;font-size:15px}button{font:600 16px/1.5 system-ui;min-height:44px;width:100%;border:0;border-radius:12px;padding:10px 16px;margin-block-start:16px;background:#c9f269;color:#14151a;cursor:pointer}button:disabled{opacity:.6;cursor:wait}button:focus-visible{outline:3px solid var(--ink);outline-offset:3px}[role=alert]{border-inline-start:3px solid #b42318;padding-inline-start:12px}#status:empty{display:none}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;
  const hash = (value: string) => createHash("sha256").update(value).digest("base64");
  const policy = `default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(css)}'; connect-src 'none'; img-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><title>Evnelo</title><style>${css}</style></head><body><h1></h1><p id="status" role="status" aria-live="polite"></p><main id="cards" aria-label="Evnelo"></main><script type="module">${script}</script></body></html>`;
}
