import { afterEach, expect, test, vi } from "vitest";
import { createServer, request, type Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const servers: Server[] = [];
afterEach(async () => { for (const s of servers.splice(0)) await new Promise<void>(resolve => { s.closeAllConnections(); s.close(() => resolve()); }); });
async function start(options: Record<string, unknown> = {}) {
  const mod = await import("./http.js").catch(() => ({})) as Record<string, any>;
  expect(mod.createPublicHttpServer, "HTTP server factory exists").toBeTypeOf("function");
  const server: Server = mod.createPublicHttpServer({ baseUrl: "http://localhost:3000", ...options });
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

test("metadata requests have a global rate ceiling independent of spoofed forwarded IPs", async () => {
  const { url } = await start({ rateLimit: { max: 2, windowMs: 1000 } });
  const send = (ip: string) => fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "x-forwarded-for": ip }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "rate-test", version: "1" } } }) });
  expect((await send("1.1.1.1")).status).toBe(200);
  expect((await send("2.2.2.2")).status).toBe(200);
  const limited = await send("3.3.3.3");
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("1");
  await new Promise(resolve => setTimeout(resolve, 1100));
  expect((await send("4.4.4.4")).status).toBe(200);
});

test("HTTP rejects every JSON-RPC array before dispatch, including a 40-call batch under one quota", async () => {
  let calls = 0;
  const upstream = createServer((_req, res) => {
    calls++;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ data: [], pagination: { limit: 48, offset: 0, nextOffset: null } }));
  });
  servers.push(upstream);
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const apiUrl = `http://127.0.0.1:${(upstream.address() as { port: number }).port}`;
  const call = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_public_events", arguments: {} } };
  for (const body of [Array.from({ length: 40 }, (_, id) => ({ ...call, id })), [call], []]) {
    const { url } = await start({ apiUrl, rateLimit: { max: 1, windowMs: 60_000 } });
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify(body) });
    await response.text();
    expect(response.status).toBe(400);
    expect(calls).toBe(0);
  }
});

test("40 rapid downstream aborts cancel real upstream response bodies without exceeding 32 work slots", async () => {
  let active = 0;
  let maximum = 0;
  let calls = 0;
  let closed = 0;
  const upstream = createServer((_req, res) => {
    calls++;
    maximum = Math.max(maximum, ++active);
    res.once("close", () => { active--; closed++; });
    // Fetch headers settle immediately; SDK JSON/body consumption remains pending.
    res.writeHead(200, { "content-type": "application/json" });
    res.write('{"data":[');
  });
  servers.push(upstream);
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const { url } = await start({ apiUrl: `http://127.0.0.1:${(upstream.address() as { port: number }).port}` });
  for (let id = 0; id < 40; id++) {
    const previousCalls = calls;
    let status: number | undefined;
    const downstream = request(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" } }, res => { status = res.statusCode; res.resume(); });
    downstream.on("error", () => { /* Expected socket reset on deliberate abort. */ });
    downstream.end(JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "search_public_events", arguments: { query: `abort-${id}` } } }));
    await expect.poll(() => calls > previousCalls || status === 503, { timeout: 1000, interval: 5 }).toBe(true);
    const disconnected = new Promise<void>(resolve => downstream.once("close", resolve));
    downstream.destroy();
    await disconnected;
  }
  expect.soft(maximum, "real concurrent upstream work").toBeLessThanOrEqual(32);
  await expect.poll(() => active, { timeout: 1000, interval: 5 }).toBe(0);
  expect(closed).toBe(calls);
  // Cancellation must return capacity before the five-second upstream deadline.
  const retry = request(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" } });
  retry.on("error", () => {});
  retry.end(JSON.stringify({ jsonrpc: "2.0", id: 100, method: "tools/call", params: { name: "search_public_events", arguments: {} } }));
  await expect.poll(() => calls, { timeout: 1000, interval: 5 }).toBe(closed + 1);
  retry.destroy();
  await expect.poll(() => active, { timeout: 1000, interval: 5 }).toBe(0);
}, 8000);

test("shared work slots survive disconnect until real upstream body consumption settles", async () => {
  let calls = 0;
  let active = 0;
  let maximum = 0;
  let consuming = 0;
  let releaseBodies!: () => void;
  const bodySettlement = new Promise<void>(resolve => { releaseBodies = resolve; });
  const upstream = createServer((_req, res) => {
    calls++;
    maximum = Math.max(maximum, ++active);
    res.once("close", () => { active--; });
    res.writeHead(200, { "content-type": "application/json" });
    res.write('{"data":[');
  });
  servers.push(upstream);
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const apiUrl = `http://127.0.0.1:${(upstream.address() as { port: number }).port}`;
  const { url } = await start({ apiUrl });
  const realFetch = globalThis.fetch;
  // Real network and real body reader; hold only its final settlement to expose
  // the disconnect/body-consumption race deterministically, without fake data.
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (...args) => {
    const response = await realFetch(...args);
    if (args[0] instanceof Request && args[0].url.startsWith(apiUrl)) {
      const readText = response.text.bind(response);
      response.text = async () => {
        consuming++;
        try { return await readText(); }
        finally { await bodySettlement; consuming--; }
      };
    }
    return response;
  });
  const downstreams: ReturnType<typeof request>[] = [];
  const send = (id: number, onStatus?: (status: number | undefined) => void) => {
    const downstream = request(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" } }, res => { onStatus?.(res.statusCode); res.resume(); });
    downstream.on("error", () => {});
    downstream.end(JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "search_public_events", arguments: {} } }));
    downstreams.push(downstream);
    return downstream;
  };
  try {
    for (let id = 0; id < 32; id++) send(id);
    await expect.poll(() => consuming, { timeout: 2000, interval: 5 }).toBe(32);
    expect(active).toBe(32);
    let fullStatus: number | undefined;
    send(32, status => { fullStatus = status; });
    await expect.poll(() => fullStatus, { timeout: 1000, interval: 5 }).toBe(503);
    await Promise.all(downstreams.slice(0, 32).map(downstream => new Promise<void>(resolve => {
      downstream.once("close", resolve); downstream.destroy();
    })));
    await expect.poll(() => active, { timeout: 1000, interval: 5 }).toBe(0);
    expect(consuming).toBe(32);
    let retryStatus: number | undefined;
    send(33, status => { retryStatus = status; });
    await expect.poll(() => retryStatus !== undefined || calls > 32, { timeout: 1000, interval: 5 }).toBe(true);
    expect(retryStatus, "disconnected but unsettled work still occupies shared capacity").toBe(503);
    expect(calls).toBe(32);
    expect(maximum).toBe(32);
    releaseBodies();
    await expect.poll(() => consuming, { timeout: 1000, interval: 5 }).toBe(0);
    send(34);
    await expect.poll(() => calls, { timeout: 1000, interval: 5 }).toBe(33);
  } finally {
    releaseBodies();
    for (const downstream of downstreams) downstream.destroy();
    fetchSpy.mockRestore();
  }
}, 8000);

test("configured upstream is an origin, never credentials, arbitrary schemes or paths", async () => {
  const mod = await import("./http.js").catch(() => ({})) as Record<string, any>;
  expect(mod.createPublicHttpServer).toBeTypeOf("function");
  for (const baseUrl of ["file:///etc/passwd", "http://user:pass@localhost:3000", "http://localhost:3000/private", "http://localhost:3000?token=secret", "http://localhost:3000/#token", "http://localhost:3000/a/../", "http://localhost:3000/#", "http://169.254.169.254"]) {
    expect(() => mod.createPublicHttpServer({ baseUrl })).toThrow();
  }
});
