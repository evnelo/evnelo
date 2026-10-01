import { writeFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildPluginArchive, collectPluginFiles, validatePluginFiles, pluginMembers } from "./plugin-package.js";

const root = fileURLToPath(new URL("../../../plugins/evnelo-public/", import.meta.url));
try {
  const args = process.argv.slice(2);
  if (!(args.length === 1 && args[0] === "--check") && !(args.length === 2 && args[0] === "--out")) throw new Error("Usage: package-plugin.ts --check | --out /absolute/outside/repository/package.zip");
  if (args[0] === "--check") {
    validatePluginFiles(collectPluginFiles(root));
    console.log(`Validated ${pluginMembers.length} files (offline); publication gates remain manual.`);
  } else {
    const out = args[1]!;
    if (!isAbsolute(out) || !out.endsWith(".zip")) throw new Error("Output must be an absolute .zip path outside the repository");
    const repo = realpathSync(resolve(root, "../.."));
    const parent = realpathSync(dirname(out));
    const contained = relative(repo, parent);
    if (contained === "" || (!contained.startsWith("../") && !isAbsolute(contained))) throw new Error("Output must be outside the repository, including resolved symlink parents");
    const { bytes } = buildPluginArchive(root);
    writeFileSync(out, bytes, { flag: "wx", mode: 0o644 });
    console.log(`Built ${out}: ${bytes.length} bytes; SHA-256 ${createHash("sha256").update(bytes).digest("hex")}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Plugin packaging failed");
  process.exitCode = 1;
}
