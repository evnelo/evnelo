import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { buildEventCardsScript } from "../src/ui-build.js";

const dir = resolve(process.env.MCP_BUILD_DIR ?? "dist");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, "cards.js"), await buildEventCardsScript());
await build({
  entryPoints: { "http-server": "src/http-server.ts", healthcheck: "src/healthcheck.ts" },
  outdir: dir, outExtension: { ".js": ".mjs" }, bundle: true, platform: "node", format: "esm", target: "node22",
  external: ["./ui-build.js"], sourcemap: false, minify: true,
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
});
