import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { Ajv2020 } from "ajv/dist/2020.js";
import { zipSync } from "fflate";

export const pluginMembers = ["assets/icon.svg", "mcp.json", "plugin.json", "skills/discover-public-events/SKILL.md"] as const;
export type PluginFiles = Record<string, Uint8Array>;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const schema = (name: string) => JSON.parse(readFileSync(new URL(`../schemas/agent-plugins-1.0.0/${name}.schema.json`, import.meta.url), "utf8"));
type ReviewCase = { description: string; prompt: string; tools_triggered?: string; expected_behavior?: string };
type Listing = { displayName: string; shortDescription: string; longDescription: string; developerName: string; category: string; capabilities: string[]; defaultPrompt: string[]; websiteURL: string; supportURL: string; privacyPolicyURL: string; termsOfServiceURL: string; logo: string; composerIcon: string };
type PluginManifest = { name: string; version: string; license: string; description: string; author: { name: string; email?: string; url?: string }; homepage?: string; extensions: Record<string, { interface: Listing; review: { commerce: boolean; commerce_description: string; test_cases: { positive: ReviewCase[]; negative: ReviewCase[] } } }> };
const checkManifest = ajv.compile<PluginManifest>(schema("plugin"));
const checkMcp = ajv.compile<{ mcpServers: Record<string, Record<string, unknown>> }>(schema("mcp"));

export function collectPluginFiles(root: string): PluginFiles {
  const allowedDirectories = new Set(["", "assets", "skills", "skills/discover-public-events"]);
  function walk(name: string) {
    const path = resolve(root, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`Symlink forbidden: ${name || "root"}`);
    if (stat.isDirectory()) {
      if (!allowedDirectories.has(name)) throw new Error(`Unexpected directory: ${name}`);
      for (const child of readdirSync(path).sort()) walk(name ? `${name}/${child}` : child);
    } else if (!stat.isFile() || !(pluginMembers as readonly string[]).includes(name)) {
      throw new Error(`Unexpected file: ${name}`);
    }
  }
  walk("");
  return Object.fromEntries(pluginMembers.map(name => [name, readFileSync(resolve(root, name))]));
}

export function validatePluginFiles(files: PluginFiles) {
  for (const name of Object.keys(files)) {
    if (name.includes("\\") || name.includes("\0") || name.split("/").some(part => !part || part === "." || part === "..") || /^[A-Za-z]:/.test(name)) throw new Error(`Unsafe path: ${name}`);
  }
  for (const name of pluginMembers) if (!Object.hasOwn(files, name)) throw new Error(`Missing required member: ${name}`);
  for (const name of Object.keys(files)) if (!(pluginMembers as readonly string[]).includes(name)) throw new Error(`Unexpected file: ${name}`);
  const manifest = JSON.parse(Buffer.from(files["plugin.json"]!).toString("utf8"));
  const mcp = JSON.parse(Buffer.from(files["mcp.json"]!).toString("utf8"));
  if (!checkManifest(manifest)) throw new Error(`Manifest schema: ${ajv.errorsText(checkManifest.errors)}`);
  if (!checkMcp(mcp)) throw new Error(`MCP schema: ${ajv.errorsText(checkMcp.errors)}`);
  const servers = Object.values(mcp.mcpServers);
  const server = servers[0] as Record<string, unknown> | undefined;
  if (servers.length !== 1 || !server || server.type !== "streamable-http" || server.url !== "https://evnelo.com/mcp" || Object.keys(server).sort().join(",") !== "type,url") throw new Error("Exactly one anonymous Streamable HTTP server at https://evnelo.com/mcp is required");
  for (const [name, bytes] of Object.entries(files)) {
    const content = Buffer.from(bytes).toString("utf8");
    if (/\b(?:TODO|TBD|PLACEHOLDER)\b/i.test(content)) throw new Error(`Placeholder content forbidden: ${name}`);
    if (/(?:\b(?:api[_-]?key|password|access[_-]?token|client[_-]?secret)\s*[=:]\s*\S+|Bearer\s+\S+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\$\{[^}]+\})/i.test(content)) throw new Error(`Credential or environment interpolation forbidden: ${name}`);
  }
  const extension = manifest.extensions?.["com.openai"];
  const onlyKeys = (value: unknown, keys: string[], label: string) => {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error(`Unsupported ${label} fields`);
  };
  onlyKeys(manifest.extensions, ["com.openai"], "extension namespace");
  onlyKeys(extension, ["interface", "review"], "OpenAI extension");
  if (!extension) throw new Error("Unsupported missing OpenAI extension");
  onlyKeys(extension.review, ["commerce", "commerce_description", "test_cases"], "review");
  if (extension.review.commerce !== false) throw new Error("Unsupported commerce: this package is discovery-only");
  onlyKeys(extension.review.test_cases, ["positive", "negative"], "test case groups");
  const listing = extension?.interface;
  const text = (value: unknown, max: number, label: string) => {
    if (typeof value !== "string" || !value.trim() || [...value].length > max || /[\x00-\x09\x0b-\x1f\x7f]/.test(value)) throw new Error(`${label}: invalid text or length`);
  };
  if (!listing) throw new Error("Listing is required");
  onlyKeys(listing, ["displayName", "shortDescription", "longDescription", "developerName", "category", "capabilities", "websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL", "defaultPrompt", "logo", "composerIcon"], "Listing");
  text(manifest.description, 4000, "Identity description");
  text(manifest.author?.name, 120, "Identity author name");
  if (manifest.author.email !== undefined) text(manifest.author.email, 320, "Identity author email");
  for (const value of [manifest.author.url, manifest.homepage]) if (value !== undefined) {
    text(value, 2048, "Identity URL");
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Identity URL requires HTTPS without credentials");
  }
  if (manifest.name !== "evnelo-public" || manifest.version !== "0.1.0" || manifest.license !== "Apache-2.0" || manifest.author.name !== "InEvent") throw new Error("Identity must match the curated Evnelo public release");
  text(extension.review.commerce_description, Infinity, "Review commerce_description");
  for (const key of ["displayName", "shortDescription", "longDescription", "developerName"] as const) text(listing[key], { displayName: 30, shortDescription: 30, longDescription: 4000, developerName: 80 }[key], `Listing ${key}`);
  if (listing.category !== "Productivity") throw new Error("Listing category must be Productivity for this package");
  for (const key of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"] as const) {
    text(listing[key], 1024, `Listing ${key}`);
    const url = new URL(listing[key]);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error(`Listing ${key}: HTTPS without credentials required`);
  }
  const prompts = listing.defaultPrompt;
  if (!Array.isArray(prompts) || prompts.length !== 3 || new Set(prompts).size !== prompts.length) throw new Error("Listing requires three unique starter prompts");
  for (const prompt of prompts) {
    text(prompt, 128, "Listing defaultPrompt");
    if (/@/.test(prompt)) throw new Error("Listing starter prompts cannot contain app mentions");
  }
  if (!Array.isArray(listing.capabilities) || listing.capabilities.length > 20) throw new Error("Listing capabilities limit");
  for (const capability of listing.capabilities) text(capability, 120, "Listing capability");
  for (const key of ["logo", "composerIcon"] as const) if (listing[key] !== "./assets/icon.svg") throw new Error(`Listing ${key}: packaged icon required`);
  const cases = extension.review?.test_cases;
  if (!cases || !Array.isArray(cases.positive) || cases.positive.length !== 5 || !Array.isArray(cases.negative) || cases.negative.length !== 3) throw new Error("Review requires five positive and three negative cases");
  for (const group of ["positive", "negative"] as const) for (const item of cases[group]) {
    onlyKeys(item, ["description", "prompt", "tools_triggered", "expected_behavior"], "Review case");
    text(item.description, group === "positive" ? 4000 : Infinity, "Review description");
    text(item.prompt, Infinity, "Review prompt");
    if (group === "positive") {
      text(item.tools_triggered, Infinity, "Review tools_triggered");
      text(item.expected_behavior, Infinity, "Review expected_behavior");
    }
  }
  const icon = files["assets/icon.svg"]!;
  // This narrow package ships the unchanged, reviewed brand SVG, not arbitrary user artwork.
  if (icon.length > 5 * 1024 * 1024 || createHash("sha256").update(icon).digest("hex") !== "83fd74964085213b490e58a35632fa036c12593d27e5b0bed225f9af95cb00f0") throw new Error("Icon must be the unchanged square 64x64 Evnelo brand SVG");
  const skill = Buffer.from(files["skills/discover-public-events/SKILL.md"]!).toString("utf8");
  if (!/^---\nname: discover-public-events\ndescription: [^\n]+\n---\n/.test(skill)) throw new Error("Skill requires matching name and description frontmatter");
  return manifest;
}

export function buildPluginArchive(root: string) {
  const files = collectPluginFiles(root);
  const manifest = validatePluginFiles(files);
  // Local civil date keeps DOS ZIP timestamps identical across time zones.
  const bytes = zipSync(files, { level: 9, mtime: new Date(1980, 0, 1, 0, 0, 0) });
  return { bytes, manifest };
}
