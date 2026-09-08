#!/usr/bin/env node
/**
 * OpenTicket MCP server (stdio). Thin client over the REST API so it never
 * diverges from what the UI can do. Configure with:
 *   OPENTICKET_URL=https://your-instance  OPENTICKET_API_KEY=ot_live_...
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = process.env.OPENTICKET_URL ?? "http://localhost:3000";
const KEY = process.env.OPENTICKET_API_KEY ?? "";

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}`, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return text;
}
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

const server = new McpServer({ name: "openticket", version: "0.1.0" });

server.tool("search_public_events", "Search public events on the discovery dashboard (no auth needed).",
  { query: z.string().optional(), city: z.string().optional(), tag: z.string().optional() },
  async (a) => text(await api(`/public/events?${new URLSearchParams(Object.entries(a).filter(([, v]) => v) as [string, string][])}`)));

server.tool("list_events", "List events in the connected organization.", { status: z.enum(["draft", "published", "cancelled", "ended"]).optional() },
  async (a) => text(await api(`/events${a.status ? `?status=${a.status}` : ""}`)));

server.tool("get_event", "Get one event with ticket types and registration fields.", { eventId: z.string() },
  async (a) => text(await api(`/events/${a.eventId}`)));

server.tool("create_event", "Create a draft event.",
  {
    name: z.string(), startsAt: z.string().describe("ISO 8601"), endsAt: z.string(), timezone: z.string(),
    descriptionMd: z.string().optional(), visibility: z.enum(["public", "unlisted", "private"]).default("public"),
    locationType: z.enum(["in_person", "online", "hybrid"]).default("in_person"), venueName: z.string().optional(),
    address: z.string().optional(), city: z.string().optional(), tags: z.array(z.string()).optional(),
  },
  async (a) => text(await api("/events", { method: "POST", body: JSON.stringify(a) })));

server.tool("update_event", "Update fields on an event.", { eventId: z.string(), patch: z.record(z.unknown()) },
  async (a) => text(await api(`/events/${a.eventId}`, { method: "PATCH", body: JSON.stringify(a.patch) })));

server.tool("publish_event", "Publish a draft event. Public events become discoverable.", { eventId: z.string(), confirm: z.literal(true) },
  async (a) => text(await api(`/events/${a.eventId}/publish`, { method: "POST" })));

server.tool("create_ticket_type", "Add a ticket type. priceMinor 0 = free.",
  { eventId: z.string(), name: z.string(), priceMinor: z.number().int().min(0), currency: z.string().length(3).default("USD"), quantity: z.number().int().optional() },
  async (a) => text(await api(`/events/${a.eventId}/ticket-types`, { method: "POST", body: JSON.stringify(a) })));

server.tool("list_registrations", "List attendees for an event, with their answers.", { eventId: z.string(), status: z.string().optional() },
  async (a) => text(await api(`/events/${a.eventId}/attendees${a.status ? `?status=${a.status}` : ""}`)));

server.tool("export_attendees", "Export attendees as CSV.", { eventId: z.string() },
  async (a) => text(await api(`/events/${a.eventId}/attendees.csv`, { headers: { accept: "text/csv" } })));

server.tool("get_event_stats", "Registrations, revenue, and check-ins for an event.", { eventId: z.string() },
  async (a) => text(await api(`/events/${a.eventId}/stats`)));

server.tool("send_attendee_update", "Send a transactional update to all registered attendees. Requires confirm=true.",
  { eventId: z.string(), message: z.string().max(1000), confirm: z.literal(true) },
  async (a) => text(await api(`/events/${a.eventId}/updates`, { method: "POST", body: JSON.stringify({ message: a.message }) })));

server.resource("event", "openticket://events/{eventId}", async (uri) => ({
  contents: [{ uri: uri.href, mimeType: "text/markdown", text: await api(`/events/${uri.pathname.split("/").pop()}.md`) }],
}));

await server.connect(new StdioServerTransport());
