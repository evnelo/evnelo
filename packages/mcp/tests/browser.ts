import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createPublicHttpServer } from "../src/http.js";
import assert from "node:assert/strict";

const dir = process.env.MCP_EVIDENCE_DIR ?? await mkdtemp(join(tmpdir(), "evnelo-mcp-evidence-"));
await mkdir(dir, { recursive: true });
const http = createPublicHttpServer({ baseUrl: process.env.EVNELO_URL ?? "http://localhost:3000" });
await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
const client = new Client({ name: "browser-evidence", version: "1" });
let host: ReturnType<typeof createServer> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${(http.address() as any).port}/mcp`)));
  const tools = (await client.listTools()).tools;
  const search = await client.callTool({ name: "search_public_events", arguments: {} });
  const events = (search.structuredContent as any).events;
  assert(events.length > 0, "local public events required");
  const hiddenIds = (process.env.MCP_HIDDEN_EVENT_IDS ?? "").split(",").filter(Boolean);
  const denials = [];
  for (const id of hiddenIds) {
    const denied = await client.callTool({ name: "render_event_cards", arguments: { search: {}, eventIds: [id] } });
    assert.equal(denied.isError, true);
    assert.equal(denied.structuredContent, undefined);
    assert(!JSON.stringify(search).includes(id));
    denials.push({ id, isError: true, noStructuredContent: true });
  }
  await writeFile(`${dir}/hidden-event-denials.json`, JSON.stringify(denials, null, 2));
  const result = await client.callTool({ name: "render_event_cards", arguments: { search: {}, eventIds: events.map((e: any) => e.id) } });
  const uri = (tools.find(t => t.name === "render_event_cards")!._meta!.ui as any).resourceUri;
  const resourceContent = (await client.readResource({ uri })).contents[0]!;
  assert("text" in resourceContent, "resource must be text HTML");
  const resource = resourceContent.text;
  await writeFile(`${dir}/served-resource.html`, resource);
  await writeFile(`${dir}/sdk-transcript.json`, JSON.stringify({ tools, search, result, uri }, null, 2));
  const harness = (await build({ entryPoints: ["tests/host.ts"], bundle: true, write: false, format: "esm", platform: "browser" })).outputFiles![0]!.text;
  host = createServer((req, res) => {
    if (req.url === "/resource") { res.setHeader("Content-Type", "text/html"); res.end(resource); }
    else if (req.url === "/host.js") { res.setHeader("Content-Type", "text/javascript"); res.end(harness); }
    else if (req.url === "/result") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(result)); }
    else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html><head><title>MCP Apps deterministic host harness</title></head><body style="margin:0"><iframe title="Public event cards" sandbox="allow-scripts" style="width:100%;height:1100px;border:0"></iframe><script type="module" src="/host.js"></script></body></html>'); }
  });
  await new Promise<void>(resolve => host!.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({ headless: true, executablePath: process.env.MCP_CHROMIUM_PATH, args: ["--no-sandbox"] });
  const records = [];
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.route("**/*", route => {
      const u = new URL(route.request().url());
      return ["localhost", "127.0.0.1"].includes(u.hostname) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${(host.address() as any).port}`);
    const frame = page.frameLocator("iframe");
    await frame.locator("article").first().waitFor({ timeout: 6000 });
    assert.equal(await frame.locator("article").count(), events.length);
    assert.equal(await frame.locator("h2").first().textContent(), events[0].name);
    assert.equal(await frame.locator("time").count(), events.length);
    assert((await frame.locator("article").first().innerText()).includes(events[0].timezone));
    const overflow = await frame.locator("html").evaluate(el => el.scrollWidth > el.clientWidth);
    assert.equal(overflow, false);
    await page.screenshot({ path: `${dir}/cards-${width}.png`, fullPage: true });
    const popupPromise = context.waitForEvent("page");
    await frame.getByRole("button", { name: "View event", exact: true }).first().click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    assert.equal(popup.url(), events[0].url);
    assert((await popup.title()).includes(events[0].name));
    await popup.close();
    await page.evaluate(async () => { await (window as any).bridge.sendToolResult({ content: [], structuredContent: { events: [], pagination: { limit: 48, offset: 0, nextOffset: null } } }); });
    await frame.getByRole("status").filter({ hasText: "No upcoming public events yet." }).waitFor();
    assert.equal(await frame.locator("article").count(), 0);
    await page.screenshot({ path: `${dir}/empty-${width}.png`, fullPage: true });
    await page.evaluate(async () => { await (window as any).bridge.sendToolResult({ isError: true, content: [{ type: "text", text: "unavailable" }] }); });
    await frame.getByRole("alert").waitFor();
    await page.screenshot({ path: `${dir}/error-${width}.png`, fullPage: true });
    for (const tag of ["pt-BR", "zh-CN", "ar", "es"]) {
      const catalogue = JSON.parse(await readFile(new URL(`../../../apps/web/messages/${tag}/public.json`, import.meta.url), "utf8"));
      await page.evaluate(async tag => {
        (window as any).bridge.setHostContext({ locale: tag, theme: "dark" });
        await (window as any).bridge.sendToolResult(await fetch("/result").then(r => r.json()));
      }, tag);
      await frame.getByRole("heading", { name: catalogue.home.upcoming.title, exact: true }).waitFor({ timeout: 1500 });
      assert.equal(await frame.locator("html").getAttribute("lang"), tag);
      assert.equal(await frame.locator("html").getAttribute("dir"), tag === "ar" ? "rtl" : "ltr");
      assert.equal(await frame.locator("html").getAttribute("data-theme"), "dark");
      assert.equal(await frame.locator("html").evaluate(el => el.scrollWidth > el.clientWidth), false);
      await page.screenshot({ path: `${dir}/cards-${width}-${tag}-dark.png`, fullPage: true });
    }
    assert.deepEqual(errors, []);
    records.push({ width, cards: events.length, overflow, errors, openedUrl: events[0].url, empty: true, error: true, locales: ["en-US", "pt-BR", "zh-CN", "ar", "es"], dark: true });
    await context.close();
  }
  await writeFile(`${dir}/browser-results.json`, JSON.stringify({ host: "MCP Apps AppBridge harness, NOT real ChatGPT", records }, null, 2));
  console.log(JSON.stringify(records, null, 2));
} finally {
  await browser?.close();
  await client.close();
  host?.closeAllConnections(); host?.close();
  http.closeAllConnections(); http.close();
}
