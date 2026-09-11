#!/usr/bin/env node
/**
 * Evnelo MCP server (stdio). A thin layer over the REST API through @ot/sdk, so it can never
 * do more than an API key can. Configure with:
 *   EVNELO_URL=https://your-instance  EVNELO_API_KEY=ev_live_...
 *
 * `send_attendee_update` is not implemented: the API has no endpoint for organizer
 * broadcasts yet, and the tool would need one rather than a client-side loop over attendees.
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createEvneloClient } from "@ot/sdk";

const baseUrl = process.env.EVNELO_URL ?? "http://localhost:3000";
const apiKey = process.env.EVNELO_API_KEY;
const client = createEvneloClient({ baseUrl, apiKey });

type ApiError = { error?: { code?: string; message?: string; issues?: Array<{ path?: (string | number)[]; message?: string }> } };
type ApiResult<T> = { data?: T; error?: unknown; response: Response };

/** Turn the `{ data, error, response }` triple into data or an error a model can act on. */
function unwrap<T>(result: ApiResult<T>): T {
  if (result.error === undefined && result.response.ok) return result.data as T;
  const body = (result.error ?? {}) as ApiError;
  const status = result.response.status;
  const detail = body.error?.message ?? result.response.statusText ?? "request failed";
  const issues = body.error?.issues?.map((i) => `${(i.path ?? []).join(".") || "body"}: ${i.message}`).join("; ");
  const hint = {
    401: apiKey ? "The API key was rejected. Check EVNELO_API_KEY (Dashboard → Settings → API keys)." : "Set EVNELO_API_KEY; only search_public_events works without a key.",
    403: "The API key lacks the write scope this tool needs. Create a key with read + write scopes.",
    404: "No such object in this organization. Use list_events to find valid ids.",
    409: "The object is in a state that does not allow this (for example already published, or already used).",
    422: issues ? `Fix the input: ${issues}` : "The input did not validate.",
    429: "Rate limited (120 requests per minute per key). Wait a moment and retry.",
  }[status] ?? "";
  throw new Error(`Evnelo API ${status} ${body.error?.code ?? ""}: ${detail}${hint ? `\n${hint}` : ""}`.trim());
}

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const failure = (error: unknown) => ({ content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }], isError: true });
async function run(operation: () => Promise<unknown>) {
  try {
    return text(await operation());
  } catch (error) {
    return failure(error);
  }
}

const ulid = z.string().length(26).describe("26-character id");
const page = { limit: z.number().int().min(1).max(200).optional(), offset: z.number().int().min(0).optional().describe("pagination.nextOffset from the previous page") };
const eventFields = {
  name: z.string().min(2).max(160),
  timezone: z.string().describe("IANA zone, e.g. America/New_York"),
  startsAt: z.string().describe("ISO 8601 instant"),
  endsAt: z.string().describe("ISO 8601 instant, after startsAt"),
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/).optional(),
  descriptionMd: z.string().max(20_000).nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  locationType: z.enum(["in_person", "online", "hybrid"]).optional(),
  venueName: z.string().max(160).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  country: z.string().length(2).nullable().optional().describe("ISO 3166-1 alpha-2"),
  onlineUrl: z.string().url().nullable().optional(),
  visibility: z.enum(["public", "unlisted", "private"]).optional(),
  requiresApproval: z.boolean().optional(),
  capacity: z.number().int().min(1).nullable().optional(),
  waitlistEnabled: z.boolean().optional(),
  collectPhone: z.boolean().optional(),
  guestsEnabled: z.boolean().optional(),
  maxGuests: z.number().int().min(1).max(20).optional(),
  refundPolicy: z.string().max(5000).nullable().optional(),
  tags: z.array(z.string().min(1).max(60)).max(10).optional(),
};
const eventPatch = { ...eventFields, name: eventFields.name.optional(), timezone: eventFields.timezone.optional(), startsAt: eventFields.startsAt.optional(), endsAt: eventFields.endsAt.optional() };

const server = new McpServer({ name: "openticket", version: "0.2.0" });

server.registerTool("search_public_events", {
  description: "Search published public events across the instance (no API key needed). Filters: text, city, tag, date window, free/paid, format, near a coordinate.",
  inputSchema: {
    query: z.string().max(160).optional(), city: z.string().max(100).optional(), tag: z.string().max(60).optional(),
    from: z.string().optional().describe("ISO instant"), to: z.string().optional().describe("ISO instant"),
    price: z.enum(["free", "paid"]).optional(), format: z.enum(["online", "in_person"]).optional(),
    lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional(), radiusKm: z.number().positive().max(500).optional(),
    limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().min(0).max(5000).optional(),
  },
}, (args) => run(async () => unwrap(await client.GET("/public/events", { params: { query: args } }))));

server.registerTool("list_events", {
  description: "List events in the connected organization with registration, pending, revenue and check-in counts. Paginated.",
  inputSchema: { status: z.enum(["draft", "published", "cancelled", "ended"]).optional(), ...page },
}, (args) => run(async () => unwrap(await client.GET("/events", { params: { query: args } }))));

server.registerTool("get_event", {
  description: "One event with its ticket types, hosts, sponsors, tags and registration form fields.",
  inputSchema: { eventId: ulid },
}, ({ eventId }) => run(async () => unwrap(await client.GET("/events/{id}", { params: { path: { id: eventId } } }))));

server.registerTool("create_event", {
  description: "Create a draft event. Publish it with publish_event once it has what it needs; publishing adds a free General admission ticket when none exists.",
  inputSchema: eventFields,
}, (args) => run(async () => unwrap(await client.POST("/events", { body: args }))));

server.registerTool("update_event", {
  description: "Change fields on an event (only the fields given change). On a published event, a new time or place notifies attendees.",
  inputSchema: { eventId: ulid, ...eventPatch },
}, ({ eventId, ...patch }) => run(async () => unwrap(await client.PATCH("/events/{id}", { params: { path: { id: eventId } }, body: patch }))));

server.registerTool("publish_event", {
  description: "Publish a draft event. Public events become discoverable immediately. Requires confirm=true.",
  inputSchema: { eventId: ulid, confirm: z.literal(true).describe("Set after the user confirmed") },
}, ({ eventId }) => run(async () => unwrap(await client.POST("/events/{id}/publish", { params: { path: { id: eventId } } }))));

server.registerTool("list_ticket_types", {
  description: "Ticket types of an event with price (minor units + currency), quantity, sold and held counts.",
  inputSchema: { eventId: ulid },
}, ({ eventId }) => run(async () => unwrap(await client.GET("/events/{id}/ticket-types", { params: { path: { id: eventId } } }))));

server.registerTool("create_ticket_type", {
  description: "Add a ticket type. priceMinor is in minor units (2500 = $25.00); 0 = free. quantity null = unlimited.",
  inputSchema: {
    eventId: ulid, name: z.string().min(1).max(120), description: z.string().max(2000).nullable().optional(),
    priceMinor: z.number().int().min(0), currency: z.string().length(3).optional().describe("ISO 4217, default USD"),
    quantity: z.number().int().min(1).nullable().optional(), minPerOrder: z.number().int().min(1).max(50).optional(), maxPerOrder: z.number().int().min(1).max(50).optional(),
    salesStartAt: z.string().nullable().optional(), salesEndAt: z.string().nullable().optional(), hidden: z.boolean().optional(),
    accessCode: z.string().max(60).nullable().optional(), taxRateBps: z.number().int().min(0).max(10_000).optional(),
  },
}, ({ eventId, ...body }) => run(async () => unwrap(await client.POST("/events/{id}/ticket-types", { params: { path: { id: eventId } }, body }))));

server.registerTool("list_registrations", {
  description: "Attendees of an event with status, ticket type, answers, ticket link and check-in time. Search by name/email/phone with q. Paginated.",
  inputSchema: { eventId: ulid, q: z.string().max(160).optional(), status: z.enum(["pending_approval", "confirmed", "rejected", "cancelled", "waitlisted"]).optional(), ...page },
}, ({ eventId, ...query }) => run(async () => unwrap(await client.GET("/events/{id}/attendees", { params: { path: { id: eventId }, query } }))));

server.registerTool("export_attendees", {
  description: "Every attendee of an event as CSV (all statuses, custom answers included).",
  inputSchema: { eventId: ulid },
}, ({ eventId }) => run(async () => unwrap(await client.GET("/events/{id}/attendees/export.csv", { params: { path: { id: eventId } }, parseAs: "text" }))));

server.registerTool("get_event_stats", {
  description: "Registrations, pending approvals, net revenue (minor units), check-ins, per ticket type and per day.",
  inputSchema: { eventId: ulid },
}, ({ eventId }) => run(async () => unwrap(await client.GET("/events/{id}/stats", { params: { path: { id: eventId } } }))));

server.registerResource("event", new ResourceTemplate("openticket://events/{eventId}", { list: undefined }), {
  title: "Evnelo event", description: "Event details with ticket types and registration fields", mimeType: "application/json",
}, async (uri, { eventId }) => {
  const data = unwrap(await client.GET("/events/{id}", { params: { path: { id: String(eventId) } } }));
  return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
});

await server.connect(new StdioServerTransport());
