import { expect, test } from "vitest";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const exec = promisify(execFile);

test("packaged HTTP serves immutable real cards and initializes without workspace sources or build dependencies", async () => {
  const dir = await mkdtemp(join(tmpdir(), "evnelo-mcp-package-"));
  let child: ReturnType<typeof spawn> | undefined;
  const client = new Client({ name: "package-test", version: "1" });
  try {
    const built = await exec("pnpm", ["exec", "tsx", "scripts/build.ts"], { env: { ...process.env, MCP_BUILD_DIR: dir } });
    expect(built.stderr).toBe("");
    expect((await readdir(dir)).sort()).toEqual(["cards.js", "healthcheck.mjs", "http-server.mjs"]);
    const listener = createServer();
    await new Promise<void>(resolve => listener.listen(0, "127.0.0.1", resolve));
    const port = (listener.address() as any).port;
    await new Promise<void>(resolve => listener.close(() => resolve()));
    const env = { PATH: process.env.PATH, MCP_PORT: String(port), EVNELO_URL: "https://tickets.example.test", MCP_ALLOWED_HOSTS: `tickets.example.test,127.0.0.1:${port}`, EVNELO_API_URL: "http://app:3000" };
    child = spawn(process.execPath, [join(dir, "http-server.mjs")], { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] });
    await new Promise<void>((resolve, reject) => { child!.stdout!.once("data", () => resolve()); child!.once("exit", code => reject(new Error(`packaged server exited ${code}`))); child!.stderr!.once("data", data => reject(new Error(String(data)))); });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
    expect((await client.listTools()).tools.map(t => t.name)).toEqual(["search_public_events", "render_event_cards"]);
    const resource = await client.readResource({ uri: "ui://evnelo/public-event-cards/v1.html" });
    const html = (resource.contents[0] as any).text;
    expect(html).toContain('id="cards"');
    expect(html).toContain("https://tickets.example.test");
    expect(html).not.toMatch(/apps\/web|packages\/mcp|sourceMappingURL|http:\/\/app:3000|__EVNELO_PUBLIC_ORIGIN__/);
    expect(await readFile(join(dir, "cards.js"), "utf8")).toContain("ui/initialize");
    await expect(exec(process.execPath, [join(dir, "healthcheck.mjs")], { cwd: dir, env })).resolves.toMatchObject({ stderr: "" });
  } finally {
    await client.close();
    if (child && child.exitCode === null) { const exited = new Promise(resolve => child!.once("exit", resolve)); child.kill("SIGTERM"); await exited; }
    await rm(dir, { recursive: true, force: true });
  }
}, 20_000);
