import { expect, test } from "vitest";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

test("HTTP CLI binds loopback on configured port and serves real SDK requests", async () => {
  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, "127.0.0.1", resolve));
  const port = (listener.address() as any).port;
  await new Promise<void>(resolve => listener.close(() => resolve()));
  const child = spawn(process.execPath, ["--import", "tsx", "src/http-server.ts"], {
    env: { ...process.env, EVNELO_URL: "http://localhost:3000", EVNELO_API_KEY: "sentinel-organizer-key-not-for-http", MCP_PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"],
  });
  const client = new Client({ name: "cli-http-test", version: "1" });
  try {
    await new Promise<void>((resolve, reject) => {
      child.stdout.on("data", chunk => { if (chunk.toString().includes(`127.0.0.1:${port}/mcp`)) resolve(); });
      child.on("exit", code => reject(new Error(`HTTP entrypoint exited ${code}`)));
      child.on("error", reject);
    });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
    expect((await client.listTools()).tools).toHaveLength(2);
    if (process.env.MCP_LIVE_URL) {
      const result = await client.callTool({ name: "search_public_events", arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(JSON.stringify(result)).not.toContain("sentinel-organizer-key-not-for-http");
    }
  } finally { await client.close(); child.kill("SIGTERM"); }
});

test("existing organizer stdio retains its full tools and public search", async () => {
  const client = new Client({ name: "stdio-compatibility", version: "1" });
  const env = Object.fromEntries(Object.entries(process.env).filter((item): item is [string, string] => typeof item[1] === "string"));
  delete env.EVNELO_API_KEY;
  env.EVNELO_URL = "http://localhost:3000";
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ["--import", "tsx", "src/server.ts"], env, stderr: "pipe" }));
    const names = (await client.listTools()).tools.map(t => t.name);
    expect(names).toContain("create_event"); expect(names).toContain("get_event_stats"); expect(names).toContain("search_public_events");
    expect(names).not.toContain("render_event_cards");
    if (process.env.MCP_LIVE_URL) {
      const result = await client.callTool({ name: "search_public_events", arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(JSON.stringify(result)).toContain("design-systems-meetup");
    }
  } finally { await client.close(); }
});
