import { build } from "esbuild";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const catalogueRoot = new URL("../../../apps/web/messages/", import.meta.url);

export async function buildEventCardsScript() {
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
    define: { CATALOGUES: JSON.stringify(catalogues), INSTANCE_ORIGIN: JSON.stringify("__EVNELO_PUBLIC_ORIGIN__") },
  });
  return output.outputFiles![0]!.text;
}
