import { afterEach, expect, test } from "vitest";
import { request, type Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const servers: Server[] = [];
afterEach(async () => { for (const s of servers.splice(0)) await new Promise<void>(resolve => { s.closeAllConnections(); s.close(() => resolve()); }); });
async function start() {
  const mod = await import("./http.js").catch(() => ({})) as Record<string, any>;
  expect(mod.createPublicHttpServer, "HTTP server factory exists").toBeTypeOf("function");
  const server: Server = mod.createPublicHttpServer({ baseUrl: "http://localhost:3000" });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  return { server, url: `http://127.0.0.1:${address.port}/mcp` };
}

test("stateless HTTP initializes a real SDK client and exposes only public tools", async () => {
  const { url } = await start();
  const client = new Client({ name: "http-test", version: "1" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    expect((await client.listTools()).tools.map(t => t.name)).toEqual(["search_public_events", "render_event_cards"]);
    if (process.env.MCP_LIVE_URL) expect((await client.callTool({ name: "search_public_events", arguments: {} })).isError).not.toBe(true);
  } finally { await client.close(); }
});

test("HTTP denies rebinding, cross-origin, dangerous methods, oversized and malformed bodies", async () => {
  const { url } = await start();
  const hostileHost = await new Promise<number | undefined>((resolve, reject) => {
    const req = request(url, { method: "POST", headers: { Host: "evil.example" } }, res => { res.resume(); resolve(res.statusCode); });
    req.on("error", reject); req.end("{}");
  });
  expect(hostileHost).toBe(403);
  expect((await fetch(url, { method: "POST", headers: { origin: "https://evil.example" }, body: "{}" })).status).toBe(403);
  for (const method of ["GET", "DELETE", "PUT", "OPTIONS", "PATCH"]) expect((await fetch(url, { method })).status).toBe(405);
  expect((await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(65537) })).status).toBe(413);
  const chunked = await new Promise<number | undefined>((resolve, reject) => {
    const req = request(url, { method: "POST", headers: { "Content-Type": "application/json", "Transfer-Encoding": "chunked" } }, res => { res.resume(); resolve(res.statusCode); });
    req.on("error", reject); req.write("x".repeat(40000)); req.write("x".repeat(30000)); req.end();
  });
  expect(chunked).toBe(413);
  expect((await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{" })).status).toBe(400);
  expect((await fetch(url, { method: "POST", body: "{}" })).status).toBe(415);
  expect((await fetch(url.replace("/mcp", "/other"), { method: "POST" })).status).toBe(404);
});

test("configured upstream is an origin, never credentials, arbitrary schemes or paths", async () => {
  const mod = await import("./http.js").catch(() => ({})) as Record<string, any>;
  expect(mod.createPublicHttpServer).toBeTypeOf("function");
  for (const baseUrl of ["file:///etc/passwd", "http://user:pass@localhost:3000", "http://localhost:3000/private", "http://localhost:3000?token=secret", "http://localhost:3000/#token", "http://localhost:3000/a/../", "http://localhost:3000/#", "http://169.254.169.254"]) {
    expect(() => mod.createPublicHttpServer({ baseUrl })).toThrow();
  }
});
