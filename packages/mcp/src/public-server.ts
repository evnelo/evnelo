import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createEvneloClient } from "@evnelo/sdk";
import { z } from "zod";
import { eventCardsHtml } from "./ui-resource.js";

export const searchSchema = z.object({
  query: z.string().max(160).optional(), city: z.string().max(100).optional(), tag: z.string().max(60).optional(),
  from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(),
  price: z.enum(["free", "paid"]).optional(), format: z.enum(["online", "in_person"]).optional(),
  lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().positive().max(500).optional(),
  limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().min(0).max(5000).optional(),
}).strict();
export const cardSchema = z.object({
  id: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/), slug: z.string(), name: z.string(),
  orgName: z.string(), url: z.string().url(), startsAt: z.string(), endsAt: z.string(), timezone: z.string(),
  locationType: z.enum(["online", "in_person", "hybrid"]), venueName: z.string().nullable(), city: z.string().nullable(),
  isFree: z.boolean(), minPriceMinor: z.number().nullable(), currency: z.string().nullable(),
});
export const resultSchema = z.object({
  events: z.array(cardSchema),
  pagination: z.object({ limit: z.number(), offset: z.number(), nextOffset: z.number().nullable() }),
});
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true, idempotentHint: true };

export function validatePublicOrigin(value: string): string {
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!/^https?:\/\/[^/?#]+\/?$/i.test(value) || url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      !(url.protocol === "https:" || (url.protocol === "http:" && loopback)) ||
      url.hostname === "169.254.169.254") throw new Error("EVNELO_URL must be an HTTPS origin (HTTP only on loopback), without credentials, path, query or fragment.");
  return url.origin;
}

/** Public transport deliberately never reads EVNELO_API_KEY. Only the public REST route is used. */
export async function createPublicServer({ baseUrl }: { baseUrl: string }) {
  const origin = validatePublicOrigin(baseUrl);
  const client = createEvneloClient({ baseUrl: origin, fetch: request => fetch(request, { redirect: "error", signal: AbortSignal.timeout(5_000) }) });
  const server = new McpServer({ name: "evnelo-public", version: "0.1.0" });
  async function search(args: z.infer<typeof searchSchema>) {
    const result = await client.GET("/public/events", { params: { query: args } });
    if (!result.response.ok || !result.data) throw new Error("Public discovery unavailable. Retry later.");
    return resultSchema.parse({
      events: result.data.data.map(e => ({
        id: e.id, slug: e.slug, name: e.name, orgName: e.orgName,
        url: `${origin}/${encodeURIComponent(e.orgSlug)}/${encodeURIComponent(e.slug)}`,
        startsAt: e.startsAt, endsAt: e.endsAt, timezone: e.timezone,
        locationType: e.locationType, venueName: e.venueName, city: e.city,
        isFree: e.isFree, minPriceMinor: e.minPriceMinor, currency: e.currency,
      })), pagination: result.data.pagination,
    });
  }
  server.registerTool("search_public_events", {
    title: "Search public events", description: "Find published public events. Data-first search; no private, unlisted or draft events.",
    inputSchema: searchSchema, outputSchema: resultSchema, annotations,
  }, async args => {
    try {
      const structuredContent = await search(args);
      return { structuredContent, content: [{ type: "text", text: JSON.stringify(structuredContent) }] };
    } catch {
      return { isError: true, content: [{ type: "text", text: "Public discovery unavailable. Retry later." }] };
    }
  });
  const uri = "ui://evnelo/public-event-cards/v1.html";
  server.registerResource("public-event-cards", uri, { mimeType: "text/html;profile=mcp-app" }, async () => ({
    contents: [{ uri, mimeType: "text/html;profile=mcp-app", text: await eventCardsHtml(origin),
      _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [], frameDomains: [] } } } }],
  }));
  server.registerTool("render_event_cards", {
    title: "Show public event cards",
    description: "First search_public_events, then pass the same search filters/page and selected eventIds (at most 12). Re-fetches that public page; missing or no-longer-discoverable IDs fail closed. An empty selection displays an empty state.",
    inputSchema: z.object({ search: searchSchema, eventIds: z.array(cardSchema.shape.id).max(12) }).strict(),
    outputSchema: resultSchema, annotations, _meta: { ui: { resourceUri: uri } },
  }, async ({ search: args, eventIds }) => {
    try {
      const data = await search(args);
      const ids = [...new Set(eventIds)];
      const events = ids.map(id => data.events.find(e => e.id === id));
      if (events.some(e => !e)) throw new Error("Unavailable");
      const structuredContent = resultSchema.parse({ ...data, events });
      return { structuredContent, content: [{ type: "text", text: JSON.stringify(structuredContent) }] };
    } catch {
      return { isError: true, content: [{ type: "text", text: "Selection unavailable in this public page. Search again." }] };
    }
  });
  return server;
}
