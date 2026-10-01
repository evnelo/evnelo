import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, mkdtempSync, cpSync, symlinkSync, rmSync, writeFileSync, mkdirSync, existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = fileURLToPath(new URL("../../../plugins/evnelo-public/", import.meta.url));
export const members = ["assets/icon.svg", "mcp.json", "plugin.json", "skills/discover-public-events/SKILL.md"] as const;
const json = (name: string) => JSON.parse(readFileSync(resolve(root, name), "utf8"));

// Copy source files (not the CLI symlink) so import.meta.url selects an owned repository.
function createRepositoryFixture(includeTests = false) {
  const dir = mkdtempSync(resolve(tmpdir(), "plugin-repository-"));
  const repo = resolve(dir, "repository");
  const sourceRepo = resolve(root, "../..");
  try {
    const paths = [
      ...members.map(name => `plugins/evnelo-public/${name}`),
      "packages/mcp/package.json",
      "packages/mcp/scripts/package-plugin.ts",
      "packages/mcp/scripts/plugin-package.ts",
      "packages/mcp/schemas/agent-plugins-1.0.0/plugin.schema.json",
      "packages/mcp/schemas/agent-plugins-1.0.0/mcp.schema.json",
      ...(includeTests ? ["packages/mcp/src/plugin-package.test.ts"] : []),
    ];
    for (const path of paths) {
      const target = resolve(repo, path);
      mkdirSync(resolve(target, ".."), { recursive: true });
      cpSync(resolve(sourceRepo, path), target);
    }
    symlinkSync(realpathSync(resolve(sourceRepo, "packages/mcp/node_modules")), resolve(repo, "packages/mcp/node_modules"));
    return { dir, repo, packageDir: resolve(repo, "packages/mcp") };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

describe("portable public package", () => {
  it("preserves pre-existing repository output after unsafe CLI tests and cleanup", () => {
    const fixture = createRepositoryFixture(true);
    try {
      const sentinel = resolve(fixture.packageDir, "plugin-negative-test.zip");
      const contents = "preserve pre-existing repository output";
      writeFileSync(sentinel, contents);
      const run = spawnSync(resolve(fixture.packageDir, "node_modules/.bin/vitest"), [
        "run", "src/plugin-package.test.ts", "-t", "rejects unsafe CLI output", "--reporter=verbose",
      ], { cwd: fixture.packageDir, encoding: "utf8", timeout: 30_000 });
      expect(run.status, run.stdout + run.stderr).toBe(0);
      expect(run.stdout).toMatch(/6 passed/);
      // The child has exited: all six finally blocks have already run.
      expect(existsSync(sentinel), "unsafe CLI tests deleted pre-existing repository output during cleanup").toBe(true);
      expect(readFileSync(sentinel, "utf8")).toBe(contents);
    } finally { rmSync(fixture.dir, { recursive: true, force: true }); }
  }, 40_000);
  it.each(["description-length", "author-name", "author-email", "author-url", "homepage", "name-dots", "version", "listing-extra", "case-extra", "commerce-description", "review-null"])("rejects invalid package metadata %s", async mutation => {
    const { collectPluginFiles, validatePluginFiles } = await import("../scripts/plugin-package.js");
    const files = collectPluginFiles(root);
    const manifest = json("plugin.json");
    if (mutation === "description-length") manifest.description = "x".repeat(4001);
    if (mutation === "author-name") manifest.author.name = "x".repeat(121);
    if (mutation === "author-email") manifest.author.email = "x".repeat(321);
    if (mutation === "author-url") manifest.author.url = "http://inevent.com";
    if (mutation === "homepage") manifest.homepage = "https://user:secret@evnelo.com";
    if (mutation === "name-dots") manifest.name = "evnelo.public";
    if (mutation === "version") manifest.version = "next";
    if (mutation === "listing-extra") manifest.extensions["com.openai"].interface.apps = "./apps";
    if (mutation === "case-extra") manifest.extensions["com.openai"].review.test_cases.positive[0].test_credentials = "forbidden";
    if (mutation === "commerce-description") manifest.extensions["com.openai"].review.commerce_description = "";
    if (mutation === "review-null") manifest.extensions["com.openai"].review.test_cases.positive[0] = null;
    files["plugin.json"] = Buffer.from(JSON.stringify(manifest));
    expect(() => validatePluginFiles(files)).toThrow(/Identity|Unsupported|Review/);
  });
  it.each(["relative", "repository", "unknown-option", "check-extra", "existing-target", "symlink-parent"])("rejects unsafe CLI output %s", mutation => {
    const fixture = createRepositoryFixture();
    const dir = fixture.dir;
    const cli = resolve(fixture.packageDir, "scripts/package-plugin.ts");
    const tsx = resolve(fixture.packageDir, "node_modules/.bin/tsx");
    const repoOut = resolve(fixture.packageDir, "plugin-negative-test.zip");
    try {
      writeFileSync(repoOut, "preserve repository output");
      const output = resolve(dir, "out.zip");
      let args = ["--out", output];
      if (mutation === "relative") args = ["--out", "relative.zip"];
      if (mutation === "repository") args = ["--out", repoOut];
      if (mutation === "unknown-option") args = ["--unexpected", output];
      if (mutation === "check-extra") args = ["--check", "--out", output];
      if (mutation === "existing-target") writeFileSync(output, "preserve existing output");
      if (mutation === "symlink-parent") {
        symlinkSync(fixture.packageDir, resolve(dir, "repo-link"));
        args = ["--out", resolve(dir, "repo-link/plugin-negative-test.zip")];
      }
      const run = spawnSync(tsx, [cli, ...args], { encoding: "utf8", cwd: dir });
      expect(run.status).toBe(1);
      expect(run.stderr).toMatch(/Usage|absolute|outside|exist/);
      expect(readFileSync(repoOut, "utf8")).toBe("preserve repository output");
      if (mutation === "existing-target") expect(readFileSync(output, "utf8")).toBe("preserve existing output");
      else expect(existsSync(output)).toBe(false);
      expect(existsSync(resolve(dir, "relative.zip"))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("runs check and builds deterministic archives through the CLI across timezones", () => {
    const cli = resolve(root, "../../packages/mcp/scripts/package-plugin.ts");
    expect(() => readFileSync(cli)).not.toThrow();
    const dir = mkdtempSync(resolve(tmpdir(), "plugin-cli-"));
    const tsx = resolve(root, "../../packages/mcp/node_modules/.bin/tsx");
    try {
      const check = spawnSync(tsx, [cli, "--check"], { encoding: "utf8" });
      expect(check.status, check.stderr).toBe(0);
      expect(check.stdout).toContain("Validated 4 files");
      for (const [index, TZ] of ["Pacific/Honolulu", "Asia/Tokyo"].entries()) {
        const run = spawnSync(tsx, [cli, "--out", resolve(dir, `${index}.zip`)], { encoding: "utf8", env: { ...process.env, TZ } });
        expect(run.status, run.stderr).toBe(0);
        expect(run.stdout).toContain("SHA-256");
      }
      expect(readFileSync(resolve(dir, "0.zip"))).toEqual(readFileSync(resolve(dir, "1.zip")));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it.each(["tiny-icon", "nonsquare-icon", "oversized-icon", "script-icon", "broken-skill"])("rejects invalid packaged asset %s", async mutation => {
    const { collectPluginFiles, validatePluginFiles } = await import("../scripts/plugin-package.js");
    const files = collectPluginFiles(root);
    if (mutation === "tiny-icon") files[members[0]] = Buffer.from('<svg viewBox="0 0 32 32"></svg>');
    if (mutation === "nonsquare-icon") files[members[0]] = Buffer.from('<svg viewBox="0 0 64 48"></svg>');
    if (mutation === "oversized-icon") files[members[0]] = Buffer.from('<svg viewBox="0 0 64 64">' + " ".repeat(5 * 1024 * 1024) + '</svg>');
    if (mutation === "script-icon") files[members[0]] = Buffer.from('<svg viewBox="0 0 64 64"><script>alert(1)</script></svg>');
    if (mutation === "broken-skill") files[members[3]] = Buffer.from("missing frontmatter");
    expect(() => validatePluginFiles(files)).toThrow(/Icon|Skill/);
  });
  it.each(["apps", "hooks", "lifecyclehooks", "test_credentials", "reviewer_instructions", "id", "demo_recording_url"])("rejects unsupported or invented metadata %s", async key => {
    const { collectPluginFiles, validatePluginFiles } = await import("../scripts/plugin-package.js");
    const files = collectPluginFiles(root);
    const manifest = json("plugin.json");
    manifest.extensions["com.openai"][key] = "forbidden";
    files["plugin.json"] = Buffer.from(JSON.stringify(manifest));
    expect(() => validatePluginFiles(files)).toThrow(/Unsupported/);
  });
  it.each(["true-commerce", "review-credentials", "placeholder", "embedded-secret"])("rejects unsafe package content %s", async mutation => {
    const { collectPluginFiles, validatePluginFiles } = await import("../scripts/plugin-package.js");
    const files = collectPluginFiles(root);
    const manifest = json("plugin.json");
    if (mutation === "true-commerce") manifest.extensions["com.openai"].review.commerce = true;
    if (mutation === "review-credentials") manifest.extensions["com.openai"].review.test_credentials = "forbidden";
    if (mutation === "placeholder") manifest.description = "TODO placeholder";
    if (mutation === "embedded-secret") files[members[3]] = Buffer.from(Buffer.from(files[members[3]]!).toString() + "\nAPI_KEY=forbidden");
    files["plugin.json"] = Buffer.from(JSON.stringify(manifest));
    expect(() => validatePluginFiles(files)).toThrow(/Unsupported|Credential|Placeholder/);
  });
  it.each([
    ["displayName", "x".repeat(31)], ["shortDescription", "x".repeat(31)],
    ["longDescription", "x".repeat(4001)], ["developerName", "x".repeat(81)],
    ["displayName", " "], ["shortDescription", "contains\ttab"], ["category", "Unknown"],
    ["defaultPrompt", ["x".repeat(129)]], ["defaultPrompt", ["a", "b", "c", "d"]],
    ["defaultPrompt", ["same", "same"]], ["defaultPrompt", ["@Evnelo browse"]],
    ["capabilities", Array(21).fill("search")], ["capabilities", ["x".repeat(121)]],
    ["websiteURL", "http://evnelo.com"], ["supportURL", "https://user:secret@evnelo.com"],
    ["privacyPolicyURL", "https://evnelo.com/" + "x".repeat(1024)], ["termsOfServiceURL", ""],
    ["logo", "../icon.svg"], ["composerIcon", "./missing.svg"],
  ])("rejects invalid listing %s", async (key, value) => {
    const { collectPluginFiles, validatePluginFiles } = await import("../scripts/plugin-package.js");
    const files = collectPluginFiles(root);
    const manifest = json("plugin.json");
    manifest.extensions["com.openai"].interface[key as string] = value;
    files["plugin.json"] = Buffer.from(JSON.stringify(manifest));
    expect(() => validatePluginFiles(files)).toThrow(/Listing/);
  });
  it.each(["positive-count", "negative-count", "positive-tools", "positive-expected", "positive-description", "negative-prompt"])("rejects incomplete review %s", async mutation => {
    const { collectPluginFiles, validatePluginFiles } = await import("../scripts/plugin-package.js");
    const files = collectPluginFiles(root);
    const manifest = json("plugin.json");
    const cases = manifest.extensions["com.openai"].review.test_cases;
    if (mutation === "positive-count") cases.positive.pop();
    if (mutation === "negative-count") cases.negative.push(cases.negative[0]);
    if (mutation === "positive-tools") delete cases.positive[0].tools_triggered;
    if (mutation === "positive-expected") delete cases.positive[0].expected_behavior;
    if (mutation === "positive-description") cases.positive[0].description = "x".repeat(4001);
    if (mutation === "negative-prompt") cases.negative[0].prompt = " ";
    files["plugin.json"] = Buffer.from(JSON.stringify(manifest));
    expect(() => validatePluginFiles(files)).toThrow(/Review/);
  });
  it.each([
    { evnelo: { type: "streamable-http", url: "https://evnelo.com/mcp", headers: { Authorization: "Bearer forbidden" } } },
    { evnelo: { type: "stdio", command: "node", args: ["server.js"] } },
    { evnelo: { type: "sse", url: "https://evnelo.com/mcp" } },
    { evnelo: { type: "streamable-http", url: "https://user:secret@evnelo.com/mcp" } },
    { evnelo: { type: "streamable-http", url: "https://elsewhere.example/mcp" } },
    {},
    { evnelo: { type: "streamable-http", url: "https://evnelo.com/mcp" }, extra: { type: "streamable-http", url: "https://evnelo.com/mcp" } },
  ])("rejects non-anonymous or noncanonical servers %j", async servers => {
    const { collectPluginFiles, validatePluginFiles } = await import("../scripts/plugin-package.js");
    const files = collectPluginFiles(root);
    const mcp = json("mcp.json");
    mcp.mcpServers = servers;
    files["mcp.json"] = Buffer.from(JSON.stringify(mcp));
    expect(() => validatePluginFiles(files)).toThrow(/anonymous Streamable HTTP/);
  });
  it.each(["assets/icon.svg", "skills/discover-public-events/SKILL.md"])("rejects missing required member %s", async name => {
    const { collectPluginFiles, validatePluginFiles } = await import("../scripts/plugin-package.js");
    const files = collectPluginFiles(root);
    delete files[name];
    expect(() => validatePluginFiles(files)).toThrow(/Missing required/);
  });
  it.each([".env", "src/server.ts"])("rejects unexpected in-memory member %s", async name => {
    const { collectPluginFiles, validatePluginFiles } = await import("../scripts/plugin-package.js");
    const files = collectPluginFiles(root);
    files[name] = new Uint8Array();
    expect(() => validatePluginFiles(files)).toThrow(/Unexpected/);
  });
  it.each([".env", "src/server.ts", "apps/.app.json", "assets/extra.svg", "empty/"])("rejects unexpected tree entry %s", async name => {
    const { collectPluginFiles } = await import("../scripts/plugin-package.js");
    const fixture = mkdtempSync(resolve(tmpdir(), "plugin-fixture-"));
    try {
      cpSync(root, fixture, { recursive: true });
      mkdirSync(resolve(fixture, name.endsWith("/") ? name : name.split("/").slice(0, -1).join("/")), { recursive: true });
      if (!name.endsWith("/")) writeFileSync(resolve(fixture, name), "not for distribution");
      expect(() => collectPluginFiles(fixture)).toThrow(/Unexpected/);
    } finally { rmSync(fixture, { recursive: true, force: true }); }
  });
  it.each(["assets/icon.svg", "assets", "."])("rejects symlink at %s", async name => {
    const { collectPluginFiles } = await import("../scripts/plugin-package.js");
    const fixture = mkdtempSync(resolve(tmpdir(), "plugin-symlink-"));
    try {
      cpSync(root, fixture, { recursive: true });
      const target = name === "." ? resolve(fixture, "linked-root") : resolve(fixture, name);
      if (name !== ".") rmSync(target, { recursive: true, force: true });
      symlinkSync(name === "." ? root : resolve(root, name), target);
      expect(() => collectPluginFiles(name === "." ? target : fixture)).toThrow(/Symlink/);
    } finally { rmSync(fixture, { recursive: true, force: true }); }
  });
  it.each(["../escape", "/absolute", "assets/../icon.svg", "assets\\icon.svg", "assets//icon.svg"])("rejects unsafe member %s", async name => {
    const { collectPluginFiles, validatePluginFiles } = await import("../scripts/plugin-package.js");
    const files = collectPluginFiles(root);
    files[name] = new Uint8Array();
    expect(() => validatePluginFiles(files)).toThrow(/Unsafe path/);
  });
  it("validates offline and builds repeatable ZIP bytes with exact members", async () => {
    const script = resolve(root, "../../packages/mcp/scripts/plugin-package.ts");
    expect(() => readFileSync(script)).not.toThrow();
    const { collectPluginFiles, buildPluginArchive } = await import(script);
    const files = collectPluginFiles(root);
    expect(Object.keys(files).sort()).toEqual(members);
    const first = buildPluginArchive(root);
    expect(first.bytes).toEqual(buildPluginArchive(root).bytes);
    expect(first.manifest.name).toBe("evnelo-public");
    const { unzipSync } = await import("fflate");
    const contents = unzipSync(first.bytes);
    expect(Object.keys(contents)).toEqual(members);
    for (const name of members) expect(Buffer.from(contents[name]!)).toEqual(readFileSync(resolve(root, name)));
  });
  it("ships the real public discovery contract and unchanged brand", () => {
    expect(readdirSync(root).sort()).toEqual(["assets", "mcp.json", "plugin.json", "skills"]);
    const manifest = json("plugin.json");
    expect(manifest.name).toBe("evnelo-public");
    expect(manifest.version).toBe("0.1.0");
    expect(manifest.license).toBe("Apache-2.0");
    expect(manifest.author.name).toBe("InEvent");
    expect(manifest.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    expect(json("mcp.json")).toEqual({ $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json", mcpServers: { evnelo: { type: "streamable-http", url: "https://evnelo.com/mcp" } } });
    const extension = manifest.extensions["com.openai"];
    expect(extension.interface.displayName).toBe("Evnelo");
    expect(extension.interface.shortDescription).toBe("Discover public events");
    expect(extension.interface.category).toBe("Productivity");
    expect(extension.review.test_cases.positive).toHaveLength(5);
    expect(extension.review.test_cases.negative).toHaveLength(3);
    expect(extension.review.commerce).toBe(false);
    expect(readFileSync(resolve(root, "assets/icon.svg"))).toEqual(readFileSync(new URL("../../../apps/web/app/icon.svg", import.meta.url)));
    const skill = readFileSync(resolve(root, members[3]), "utf8");
    for (const text of ["name: discover-public-events", "search_public_events", "render_event_cards", "eventIds", "12", "text-only", "empty", "private", "checkout"]) expect(skill).toContain(text);
  });
});
