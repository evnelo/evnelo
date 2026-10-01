import { afterEach, expect, test } from "vitest";
import { createServer } from "node:http";
import { createPublicServer } from "./public-server.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const LIVE_URL = process.env.MCP_LIVE_URL;
const liveTest = test.skipIf(!LIVE_URL);
const clients: Client[] = [];
afterEach(async () => { for (const client of clients.splice(0)) await client.close(); });

async function connect() {
  const module = await import("./public-server.js").catch(() => ({})) as Record<string, any>;
  expect(module.createPublicServer, "public server factory exists").toBeTypeOf("function");
  const server = await module.createPublicServer({ baseUrl: LIVE_URL ?? "http://localhost:3000" });
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "public-test", version: "1" });
  clients.push(client);
  await server.connect(s);
  await client.connect(c);
  return client;
}

liveTest("public search is data-first, schema-validated and contains live public events only", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  expect(tools.map(t => t.name)).toEqual(["search_public_events", "render_event_cards"]);
  const tool = tools[0]!;
  expect(tool.outputSchema).toBeDefined();
  expect(tool.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, openWorldHint: true, idempotentHint: true });
  expect(tool._meta?.ui).toBeUndefined();
  const result = await client.callTool({ name: tool.name, arguments: {} });
  expect(result.isError).not.toBe(true);
  const data = result.structuredContent as any;
  expect(data.events.length).toBeGreaterThan(0);
  expect(data.events.some((e: any) => e.slug === "design-systems-meetup")).toBe(true);
  expect(data.events.every((e: any) => e.url.startsWith(`${LIVE_URL}/demo/`))).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/private|draft|accessToken|apiKey|onlineUrl/i);
});

liveTest("render re-fetches the public page, rejects unknown IDs, and returns its registered MCP Apps resource", async () => {
  const client = await connect();
  const search = await client.callTool({ name: "search_public_events", arguments: {} });
  const events = (search.structuredContent as any).events;
  const result = await client.callTool({ name: "render_event_cards", arguments: { search: {}, eventIds: [events[0].id] } });
  expect(result.isError).not.toBe(true);
  expect((result.structuredContent as any).events).toEqual([events[0]]);
  const { tools } = await client.listTools();
  const render = tools.find(t => t.name === "render_event_cards")!;
  const uri = (render._meta?.ui as any).resourceUri;
  const resource = await client.readResource({ uri });
  expect(resource.contents[0]?.mimeType).toBe("text/html;profile=mcp-app");
  expect("text" in resource.contents[0]! ? resource.contents[0].text : undefined).toContain('id="cards"');
  expect((resource.contents[0]?._meta?.ui as any).csp).toEqual({ connectDomains: [], resourceDomains: [], frameDomains: [] });
  const denied = await client.callTool({ name: "render_event_cards", arguments: { search: {}, eventIds: ["01M3SWWQZXZDVAQXS2HBCWFCBK"] } });
  expect(denied.isError).toBe(true);
  expect(denied.structuredContent).toBeUndefined();
  const forged = await client.callTool({ name: "render_event_cards", arguments: { search: {}, eventIds: [events[0].id], events: [{ name: "forged", url: "http://169.254.169.254" }] } });
  expect(forged.isError).toBe(true);
});

test("internal upstream is independent of the public canonical links and UI origin", async () => {
  const upstream = createServer((req, res) => {
    expect(req.url).toBe("/api/v1/public/events");
    expect(req.headers.authorization).toBeUndefined();
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: [{ id: "01M3SWWQZXZDVAQXS2HBCWFCBK", slug: "meeting", name: "Meeting", orgSlug: "demo", orgName: "Demo", startsAt: "2027-01-01T12:00:00Z", endsAt: "2027-01-01T13:00:00Z", timezone: "UTC", locationType: "online", venueName: null, city: null, isFree: true, minPriceMinor: null, currency: null }], pagination: { limit: 48, offset: 0, nextOffset: null } }));
  });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const internal = `http://127.0.0.1:${(upstream.address() as any).port}`;
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "split-origin-test", version: "1" });
  try {
    const server = await createPublicServer({ baseUrl: "https://tickets.example.test", apiUrl: internal });
    await server.connect(s); await client.connect(c);
    const search = await client.callTool({ name: "search_public_events", arguments: {} });
    expect(search.isError).not.toBe(true);
    expect((search.structuredContent as any).events[0].url).toBe("https://tickets.example.test/demo/meeting");
    const resource = await client.readResource({ uri: "ui://evnelo/public-event-cards/v1.html" });
    expect(JSON.stringify(resource)).toContain("https://tickets.example.test");
    expect(JSON.stringify([search, resource])).not.toContain(internal);
  } finally { await client.close(); upstream.closeAllConnections(); upstream.close(); }
}, 8000);

test("public upstream calls have a five-second deadline", async () => {
  const upstream = createServer((_req, _res) => { /* Deliberately never responds. */ });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const server = await createPublicServer({ baseUrl: `http://127.0.0.1:${(upstream.address() as any).port}` });
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "timeout-test", version: "1" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await server.connect(s); await client.connect(c);
    const result = await Promise.race([
      client.callTool({ name: "search_public_events", arguments: {} }),
      new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), 5700); }),
    ]);
    expect(result?.isError).toBe(true);
  } finally {
    clearTimeout(timer); upstream.closeAllConnections(); upstream.close(); await client.close();
  }
}, 8000);

test("public client refuses redirects and never forwards organizer or incoming credentials", async () => {
  const publicResponse = { data: [], pagination: { limit: 48, offset: 0, nextOffset: null } };
  const paths: string[] = [];
  const upstream = createServer((req, res) => {
    paths.push(req.url!);
    expect(req.headers.authorization).toBeUndefined();
    if (req.url === "/api/v1/public/events") { res.writeHead(302, { Location: "/private" }); res.end(); }
    else { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(publicResponse)); }
  });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const old = process.env.EVNELO_API_KEY;
  process.env.EVNELO_API_KEY = "sentinel-never-forward-this";
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "redirect-test", version: "1" });
  try {
    const server = await createPublicServer({ baseUrl: `http://127.0.0.1:${(upstream.address() as any).port}` });
    await server.connect(s); await client.connect(c);
    const result = await client.callTool({ name: "search_public_events", arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(paths).toEqual(["/api/v1/public/events"]);
    expect(JSON.stringify(result)).not.toContain("sentinel-never-forward-this");
  } finally {
    if (old === undefined) delete process.env.EVNELO_API_KEY; else process.env.EVNELO_API_KEY = old;
    await client.close(); upstream.closeAllConnections(); upstream.close();
  }
});
