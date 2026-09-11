import { SOCIAL_PLATFORMS, WEBHOOK_EVENTS } from "@evnelo/core";

/**
 * The OpenAPI 3.1 contract for /api/v1. Served at /api/v1/openapi.json, rendered at /api/v1/docs,
 * and the source of the generated `@evnelo/sdk` types (`pnpm --filter @evnelo/sdk generate`). Every
 * route under app/api/v1 must appear here (lib/openapi.test.ts enforces it), and every response
 * object is described so the SDK can type it.
 */

const jsonContent = (schema: Record<string, unknown>) => ({ "application/json": { schema } });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const response = (name: string) => ({ $ref: `#/components/responses/${name}` });
const nullableHttpUrl = (maxLength: number) => ({
  oneOf: [
    { type: "string", format: "uri", pattern: "^[hH][tT][tT][pP][sS]?://", maxLength },
    { type: "string", const: "" },
    { type: "null" },
  ],
  description: "Must use http:// or https://. An empty string is normalized to null.",
});
const rateLimitResponseHeaders = {
  "X-RateLimit-Limit": { $ref: "#/components/headers/RateLimitLimit" },
  "X-RateLimit-Remaining": { $ref: "#/components/headers/RateLimitRemaining" },
  "X-RateLimit-Reset": { $ref: "#/components/headers/RateLimitReset" },
} as const;
const replayedHeader = {
  "Idempotency-Replayed": { schema: { type: "string", enum: ["true"] }, description: "Present when the original response was replayed." },
} as const;

const ulid = { type: "string", minLength: 26, maxLength: 26, description: "26-character ULID." } as const;
const dateTime = { type: "string", format: "date-time" } as const;
const nullableDateTime = { type: ["string", "null"], format: "date-time" } as const;
const money = (description: string) => ({ type: "integer", description: `${description} Integer minor units (cents); see \`currency\`.` });
const nullableText = (maxLength: number) => ({ type: ["string", "null"], maxLength });

const idempotencyKeyParam = {
  name: "Idempotency-Key", in: "header", required: false,
  schema: { type: "string", minLength: 1, maxLength: 120 },
  description: "Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409.",
} as const;
const pathParam = (name: string, description: string) => ({ name, in: "path", required: true, description, schema: ulid });
const eventIdParam = pathParam("id", "Event id");
const pageParams = (maxLimit = 200, defaultLimit = 50) => [
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: maxLimit, default: defaultLimit } },
  { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 }, description: "Use `pagination.nextOffset` from the previous page." },
];

const listSchema = (item: string) => ({
  type: "object", required: ["data", "pagination"],
  properties: { data: { type: "array", items: ref(item) }, pagination: ref("Pagination") },
});
const dataSchema = (item: string) => ({ type: "object", required: ["data"], properties: { data: ref(item) } });

const authErrors = { "401": response("Unauthorized"), "403": response("Forbidden"), "429": response("RateLimited"), "500": response("InternalError") } as const;
const bodyErrors = { "400": response("BadRequest"), "413": response("PayloadTooLarge"), "415": response("UnsupportedMediaType"), "422": response("ValidationError") } as const;

type Operation = {
  tags: string[]; operationId: string; summary: string; description?: string;
  parameters?: unknown[]; requestBody?: { schema: Record<string, unknown>; description?: string };
  ok: { status?: string; description: string; schema: Record<string, unknown> };
  notFound?: boolean; conflict?: string; validation?: boolean;
};

/** Authenticated read. */
function read(op: Operation) {
  return {
    tags: op.tags, operationId: op.operationId, summary: op.summary, ...(op.description ? { description: op.description } : {}),
    security: [{ bearerAuth: [] }],
    ...(op.parameters?.length ? { parameters: op.parameters } : {}),
    responses: {
      [op.ok.status ?? "200"]: { description: op.ok.description, headers: rateLimitResponseHeaders, content: jsonContent(op.ok.schema) },
      ...authErrors,
      ...(op.notFound ? { "404": response("NotFound") } : {}),
      ...(op.validation ? { "422": response("ValidationError") } : {}),
    },
  };
}

/** Authenticated write: needs the write scope, honours Idempotency-Key, documents body failures. */
function write(op: Operation) {
  const status = op.ok.status ?? "200";
  return {
    tags: op.tags, operationId: op.operationId, summary: op.summary, ...(op.description ? { description: op.description } : {}),
    security: [{ bearerAuth: [] }],
    parameters: [...(op.parameters ?? []), idempotencyKeyParam],
    ...(op.requestBody ? { requestBody: { required: true, ...(op.requestBody.description ? { description: op.requestBody.description } : {}), content: jsonContent(op.requestBody.schema) } } : {}),
    responses: {
      [status]: { description: op.ok.description, headers: { ...rateLimitResponseHeaders, ...replayedHeader }, content: jsonContent(op.ok.schema) },
      ...(op.requestBody ? bodyErrors : { "422": response("ValidationError") }),
      ...authErrors,
      ...(op.notFound ? { "404": response("NotFound") } : {}),
      "409": { description: `${op.conflict ? `${op.conflict} Also: ` : ""}the idempotency key is in progress or was used for a different request.`, headers: rateLimitResponseHeaders, content: jsonContent(ref("ErrorResponse")) },
    },
  };
}

/** Authenticated delete: 200 with `{ data: { id, deleted: true } }`, never a body. */
function remove(op: Omit<Operation, "ok" | "requestBody"> & { conflict?: string }) {
  return {
    tags: op.tags, operationId: op.operationId, summary: op.summary, ...(op.description ? { description: op.description } : {}),
    security: [{ bearerAuth: [] }],
    parameters: op.parameters ?? [],
    responses: {
      "200": { description: "Deleted", headers: rateLimitResponseHeaders, content: jsonContent(ref("DeletedResponse")) },
      ...authErrors,
      "404": response("NotFound"),
      ...(op.conflict ? { "409": { description: op.conflict, headers: rateLimitResponseHeaders, content: jsonContent(ref("ErrorResponse")) } } : {}),
    },
  };
}

/* ---------- shared input property sets ---------- */

const eventInputProperties = {
  name: { type: "string", minLength: 2, maxLength: 160 }, slug: { type: "string", pattern: "^[a-z0-9-]{3,80}$" }, descriptionMd: nullableText(20000),
  coverImageUrl: nullableHttpUrl(500), logoUrl: nullableHttpUrl(500),
  timezone: { type: "string", minLength: 1, maxLength: 64, description: "IANA time zone used for display." }, startsAt: dateTime, endsAt: dateTime,
  locationType: { type: "string", enum: ["in_person", "online", "hybrid"], default: "in_person" }, venueName: nullableText(160), address: nullableText(300), city: nullableText(100), country: { type: ["string", "null"], pattern: "^[A-Z]{2}$" },
  lat: nullableText(20), lng: nullableText(20), onlineUrl: nullableHttpUrl(500),
  visibility: { type: "string", enum: ["public", "unlisted", "private"], default: "public" }, requiresApproval: { type: "boolean", default: false },
  capacity: { type: ["integer", "null"], minimum: 1 }, waitlistEnabled: { type: "boolean", default: false }, collectPhone: { type: "boolean", default: false },
  guestsEnabled: { type: "boolean", default: false }, maxGuests: { type: "integer", minimum: 1, maximum: 20, default: 1 }, feePassThrough: { type: "boolean", default: false },
  refundPolicy: nullableText(5000), socialLinks: { type: "array", items: ref("SocialLink"), default: [] },
  reminderHours: { type: "array", maxItems: 4, items: { type: "integer", minimum: 1, maximum: 336 }, default: [24, 1] },
  tags: { type: "array", maxItems: 10, items: { type: "string", minLength: 1, maxLength: 60 }, default: [] },
  hosts: { type: "array", maxItems: 20, items: ref("Host"), default: [] },
  sponsors: { type: "array", maxItems: 50, items: ref("Sponsor"), default: [] },
} as const;

const ticketTypeInputProperties = {
  name: { type: "string", minLength: 1, maxLength: 120 }, description: nullableText(2000),
  priceMinor: money("Price per ticket."), currency: { type: "string", minLength: 3, maxLength: 3, default: "USD", description: "ISO 4217, upper-cased." },
  quantity: { type: ["integer", "null"], minimum: 1, description: "null = unlimited." },
  minPerOrder: { type: "integer", minimum: 1, maximum: 50, default: 1 }, maxPerOrder: { type: "integer", minimum: 1, maximum: 50, default: 10 },
  salesStartAt: nullableDateTime, salesEndAt: nullableDateTime, hidden: { type: "boolean", default: false },
  accessCode: nullableText(60), taxRateBps: { type: "integer", minimum: 0, maximum: 10000, default: 0, description: "Tax rate in basis points (2300 = 23%)." },
} as const;

/* ---------- examples ---------- */

const exampleEvent = {
  id: "01J9Z6M5Y3K3F1Q2R8S9T0V1W2", organizationId: "01J9Z6M5Y3K3F1Q2R8S9T0V1W3", slug: "design-systems-meetup", name: "Design Systems Meetup", descriptionMd: "Talks and demos.",
  coverImageUrl: null, logoUrl: null, timezone: "Europe/Lisbon", startsAt: "2026-10-02T18:00:00.000Z", endsAt: "2026-10-02T21:00:00.000Z",
  locationType: "in_person", venueName: "The Loft", address: "Rua Augusta 1", city: "Lisbon", country: "PT", lat: null, lng: null, onlineUrl: null,
  visibility: "public", status: "published", requiresApproval: false, capacity: 120, waitlistEnabled: true, collectPhone: false, guestsEnabled: true, maxGuests: 1, feePassThrough: false,
  refundPolicy: null, socialLinks: [], reminderHours: [24, 1], publishedAt: "2026-09-01T09:00:00.000Z", deletedAt: null, createdAt: "2026-08-30T10:00:00.000Z", updatedAt: "2026-09-01T09:00:00.000Z",
};
const exampleTicketType = {
  id: "01J9Z6M5Y3K3F1Q2R8S9T0V1W4", eventId: exampleEvent.id, name: "Early bird", description: null, priceMinor: 2500, currency: "EUR", quantity: 50, sold: 12, held: 1,
  minPerOrder: 1, maxPerOrder: 4, salesStartAt: null, salesEndAt: "2026-09-25T00:00:00.000Z", hidden: false, accessCode: null, taxRateBps: 2300, position: 0,
  createdAt: "2026-08-30T10:00:00.000Z", updatedAt: "2026-08-30T10:00:00.000Z",
};
const exampleAttendee = {
  id: "01J9Z6M5Y3K3F1Q2R8S9T0V1W5", eventId: exampleEvent.id, orderId: "01J9Z6M5Y3K3F1Q2R8S9T0V1W6", ticketTypeId: exampleTicketType.id, userId: null, guestOfAttendeeId: null,
  name: "Ana Silva", email: "ana@example.com", phone: null, smsOptIn: false, remindersOptOut: false, status: "confirmed", answers: { role: "designer" }, deletedAt: null,
  createdAt: "2026-09-02T12:00:00.000Z", updatedAt: "2026-09-02T12:00:00.000Z", ticketTypeName: "Early bird", hostName: null,
  order: { id: "01J9Z6M5Y3K3F1Q2R8S9T0V1W6", status: "paid", totalMinor: 3075, currency: "EUR" },
  ticket: { id: "01J9Z6M5Y3K3F1Q2R8S9T0V1W7", token: "k3Jx9Qv2Lm8Np4Rt6Wy1Zb5Cd7Ef0Gh", url: "https://tickets.example.com/t/k3Jx9Qv2Lm8Np4Rt6Wy1Zb5Cd7Ef0Gh", revokedAt: null, checkedInAt: null },
};
const exampleOrder = {
  id: "01J9Z6M5Y3K3F1Q2R8S9T0V1W6", eventId: exampleEvent.id, organizationId: exampleEvent.organizationId, userId: null, email: "ana@example.com", status: "paid", currency: "EUR",
  subtotalMinor: 2500, discountMinor: 0, taxMinor: 575, serviceFeeMinor: 0, totalMinor: 3075, platformFeeMinor: 0, refundedMinor: 0, discountCodeId: null,
  stripePaymentIntentId: "pi_3Q0example", stripeAccountId: null, holdExpiresAt: null, paidAt: "2026-09-02T12:00:30.000Z", answers: { code_of_conduct: true },
  createdAt: "2026-09-02T12:00:00.000Z", updatedAt: "2026-09-02T12:00:30.000Z",
};
const exampleWebhook = { id: "01J9Z6M5Y3K3F1Q2R8S9T0V1W8", organizationId: exampleEvent.organizationId, url: "https://hooks.example.com/evnelo", events: ["order.paid", "attendee.checked_in"], active: true, createdAt: "2026-09-01T09:00:00.000Z" };

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Evnelo API",
    version: "1.0.0",
    description: [
      "Versioned JSON API for Evnelo. Organization endpoints use scoped API keys (`Authorization: Bearer ev_live_…`, created under Dashboard → Settings → API keys) with `read` or `write` scope; public discovery does not require authentication.",
      "Every organization endpoint is scoped to the key's organization: objects of other organizations answer 404. Money is integer minor units plus an ISO 4217 `currency`; timestamps are ISO 8601 in UTC.",
      "Lists paginate with `limit`/`offset` and return `pagination.nextOffset` (null on the last page). Writes accept `Idempotency-Key`. Validation failures are 422 with zod `issues`; JSON bodies are capped at 256 KiB.",
    ].join("\n\n"),
  },
  servers: [{ url: "/api/v1" }],
  externalDocs: {
    description: "Interactive API documentation",
    url: "/api/v1/docs",
  },
  tags: [
    { name: "Public", description: "Unauthenticated discovery of published public events." },
    { name: "Organization", description: "The organization that owns the API key." },
    { name: "Events", description: "Organization-scoped event management." },
    { name: "Ticket types", description: "Tickets on sale for an event." },
    { name: "Registration fields", description: "The custom registration form of an event." },
    { name: "Orders", description: "Orders and refunds." },
    { name: "Attendees", description: "Registrations, approvals and exports." },
    { name: "Check-ins", description: "Door check-in by ticket id or QR token." },
    { name: "Discount codes", description: "Percent or fixed-amount codes." },
    { name: "Waitlist", description: "Sold-out waitlist entries and seat offers." },
    { name: "Invites", description: "Invitation links for private events." },
    { name: "Webhooks", description: "Signed outbound event notifications." },
    { name: "Meta", description: "The API description itself." },
  ],
  paths: {
    "/public/events": {
      get: {
        tags: ["Public"],
        operationId: "searchPublicEvents",
        summary: "Search published public events",
        security: [],
        parameters: [
          { name: "query", in: "query", schema: { type: "string", maxLength: 160 } },
          { name: "city", in: "query", schema: { type: "string", maxLength: 100 } },
          { name: "tag", in: "query", schema: { type: "string", maxLength: 60 } },
          { name: "from", in: "query", description: "Only events still running at or after this instant.", schema: dateTime },
          { name: "to", in: "query", description: "Only events starting at or before this instant.", schema: dateTime },
          { name: "price", in: "query", description: "\"free\" matches events where every visible ticket type costs nothing.", schema: { type: "string", enum: ["free", "paid"] } },
          { name: "format", in: "query", description: "Hybrid events match both values.", schema: { type: "string", enum: ["online", "in_person"] } },
          { name: "lat", in: "query", description: "Latitude of the search origin. Must be sent with lng.", schema: { type: "number", minimum: -90, maximum: 90 } },
          { name: "lng", in: "query", description: "Longitude of the search origin. Must be sent with lat.", schema: { type: "number", minimum: -180, maximum: 180 } },
          { name: "radiusKm", in: "query", description: "Search radius in kilometres, applied only when lat and lng are given.", schema: { type: "number", exclusiveMinimum: 0, maximum: 500, default: 25 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 48 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, maximum: 5000, default: 0 }, description: "Use `pagination.nextOffset` from the previous page." },
        ],
        responses: {
          "200": { description: "Matching events", headers: rateLimitResponseHeaders, content: jsonContent(ref("PublicEventListResponse")) },
          "422": response("ValidationError"),
          "429": response("RateLimited"),
          "500": response("InternalError"),
        },
      },
    },

    "/organization": {
      get: read({ tags: ["Organization"], operationId: "getOrganization", summary: "Get the API key's organization", ok: { description: "Organization", schema: dataSchema("Organization") } }),
      patch: write({
        tags: ["Organization"], operationId: "updateOrganization", summary: "Update the organization",
        description: "Partial update: absent keys keep their value. An empty string clears `website`, `logoUrl` or `accentColor`. The slug must be unused and not reserved.",
        requestBody: { schema: ref("UpdateOrganizationInput") },
        ok: { description: "Updated organization", schema: dataSchema("Organization") }, conflict: "The slug is already taken.",
      }),
    },

    "/events": {
      get: read({
        tags: ["Events"], operationId: "listEvents", summary: "List events belonging to the API key organization",
        parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["draft", "published", "cancelled", "ended"] } }, ...pageParams()],
        ok: { description: "Organization events, latest start first, with registration, pending, revenue and check-in counts", schema: ref("EventListResponse") }, validation: true,
      }),
      post: write({
        tags: ["Events"], operationId: "createEvent", summary: "Create a draft event",
        requestBody: { schema: ref("CreateEventInput") },
        ok: { status: "201", description: "Event created", schema: ref("EventResponse") },
      }),
    },
    "/events/{id}": {
      get: read({
        tags: ["Events"], operationId: "getEvent", summary: "Get an event and its ticket types, tags, hosts, sponsors, and registration fields",
        parameters: [eventIdParam], ok: { description: "Event details", schema: ref("EventDetailsResponse") }, notFound: true,
      }),
      patch: write({
        tags: ["Events"], operationId: "updateEvent", summary: "Update an event",
        description: "Partial update. The patch is merged over the stored event, including `tags`, `hosts` and `sponsors` (send the full array to change them), and validated as a whole. On a published event a new time or place queues the \"event updated\" notifications.",
        parameters: [eventIdParam], requestBody: { schema: ref("UpdateEventInput") },
        ok: { description: "Updated event", schema: ref("EventResponse") }, notFound: true,
      }),
    },
    "/events/{id}/publish": {
      post: write({
        tags: ["Events"], operationId: "publishEvent", summary: "Publish a draft event",
        description: "A free \"General admission\" ticket type is created when the event has none, so registration works immediately. Public events become discoverable. No request body.",
        parameters: [eventIdParam], ok: { description: "Published event", schema: ref("EventResponse") }, notFound: true, conflict: "A cancelled event can't be published again.",
      }),
    },
    "/events/{id}/cancel": {
      post: write({
        tags: ["Events"], operationId: "cancelEvent", summary: "Cancel an event",
        description: "Attendees are told by email (and SMS where opted in). Paid orders are refunded separately through the orders endpoints. Cancelling twice is a no-op. No request body.",
        parameters: [eventIdParam], ok: { description: "Cancelled event", schema: ref("EventResponse") }, notFound: true,
      }),
    },
    "/events/{id}/stats": {
      get: read({
        tags: ["Events"], operationId: "getEventStats", summary: "Registrations, revenue and check-ins for an event",
        parameters: [eventIdParam], ok: { description: "Event statistics", schema: dataSchema("EventStats") }, notFound: true,
      }),
    },

    "/events/{id}/ticket-types": {
      get: read({
        tags: ["Ticket types"], operationId: "listTicketTypes", summary: "List ticket types",
        parameters: [eventIdParam, ...pageParams()], ok: { description: "Ticket types in display order", schema: listSchema("TicketType") }, notFound: true, validation: true,
      }),
      post: write({
        tags: ["Ticket types"], operationId: "createTicketType", summary: "Create a ticket type",
        parameters: [eventIdParam], requestBody: { schema: ref("TicketTypeInput") },
        ok: { status: "201", description: "Ticket type created (appended last)", schema: dataSchema("TicketType") }, notFound: true,
      }),
    },
    "/events/{id}/ticket-types/{ticketTypeId}": {
      patch: write({
        tags: ["Ticket types"], operationId: "updateTicketType", summary: "Update a ticket type",
        description: "Partial update merged over the stored ticket type. `quantity` can't drop below the seats already sold or held (422).",
        parameters: [eventIdParam, pathParam("ticketTypeId", "Ticket type id")], requestBody: { schema: ref("UpdateTicketTypeInput") },
        ok: { description: "Updated ticket type", schema: dataSchema("TicketType") }, notFound: true,
      }),
      delete: remove({
        tags: ["Ticket types"], operationId: "deleteTicketType", summary: "Delete a ticket type",
        parameters: [eventIdParam, pathParam("ticketTypeId", "Ticket type id")], conflict: "The ticket type has sales or holds; hide it instead.",
      }),
    },

    "/events/{id}/fields": {
      get: read({
        tags: ["Registration fields"], operationId: "listRegistrationFields", summary: "List the registration form fields",
        parameters: [eventIdParam], ok: { description: "Fields in form order", schema: { type: "object", required: ["data"], properties: { data: { type: "array", items: ref("RegistrationField") } } } }, notFound: true,
      }),
      put: write({
        tags: ["Registration fields"], operationId: "replaceRegistrationFields", summary: "Replace the registration form",
        description: "The whole form, in order. Include each existing field's `id` to keep collected answers attached; fields without an id are created and fields not listed are deleted. A field may only depend (`condition`) on fields before it in the same `scope`; select fields need options. Same input as the dashboard form builder.",
        parameters: [eventIdParam], requestBody: { schema: { type: "array", maxItems: 60, items: ref("RegistrationFieldInput") } },
        ok: { description: "The saved form", schema: { type: "object", required: ["data"], properties: { data: { type: "array", items: ref("RegistrationField") } } } }, notFound: true,
      }),
    },

    "/events/{id}/orders": {
      get: read({
        tags: ["Orders"], operationId: "listOrders", summary: "List orders",
        parameters: [
          eventIdParam,
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "processing", "paid", "free", "refunded", "partially_refunded", "failed", "expired"] } },
          { name: "email", in: "query", description: "Exact buyer email (case-insensitive).", schema: { type: "string", maxLength: 255 } },
          ...pageParams(),
        ],
        ok: { description: "Orders, newest first", schema: listSchema("OrderListItem") }, notFound: true, validation: true,
      }),
    },
    "/events/{id}/orders/{orderId}": {
      get: read({
        tags: ["Orders"], operationId: "getOrder", summary: "Get an order with its items and attendees",
        parameters: [eventIdParam, pathParam("orderId", "Order id")], ok: { description: "Order details", schema: dataSchema("OrderDetails") }, notFound: true,
      }),
    },
    "/events/{id}/orders/{orderId}/refund": {
      post: write({
        tags: ["Orders"], operationId: "refundOrder", summary: "Refund an order in full",
        description: "Requests a full refund from Stripe, the same path as the dashboard. The order moves to `refunded` (party cancelled, tickets revoked, seats returned) when Stripe confirms through its webhook, so poll the order or subscribe to `order.refunded`. No request body.",
        parameters: [eventIdParam, pathParam("orderId", "Order id")],
        ok: { status: "202", description: "Refund requested", schema: dataSchema("RefundRequested") }, notFound: true, conflict: "The order has no payment, or is not in a refundable status.",
      }),
    },

    "/events/{id}/attendees": {
      get: read({
        tags: ["Attendees"], operationId: "listAttendees", summary: "List attendees",
        parameters: [
          eventIdParam,
          { name: "q", in: "query", description: "Matches name, email or phone.", schema: { type: "string", maxLength: 160 } },
          { name: "status", in: "query", schema: { type: "string", enum: ["pending_approval", "confirmed", "rejected", "cancelled", "waitlisted"] } },
          ...pageParams(),
        ],
        ok: { description: "Attendees, newest first, with ticket link and check-in state", schema: listSchema("Attendee") }, notFound: true, validation: true,
      }),
    },
    "/events/{id}/attendees/export.csv": {
      get: {
        tags: ["Attendees"], operationId: "exportAttendeesCsv", summary: "Export every attendee as CSV",
        description: "All statuses, one row per person (guests included), with custom answers as columns. Same file as the dashboard export.",
        security: [{ bearerAuth: [] }], parameters: [eventIdParam],
        responses: {
          "200": { description: "CSV file", headers: { ...rateLimitResponseHeaders, "Content-Disposition": { schema: { type: "string" }, description: "attachment; filename=\"{slug}-attendees.csv\"" } }, content: { "text/csv": { schema: { type: "string" } } } },
          ...authErrors, "404": response("NotFound"),
        },
      },
    },
    "/events/{id}/attendees/{attendeeId}": {
      get: read({
        tags: ["Attendees"], operationId: "getAttendee", summary: "Get an attendee",
        parameters: [eventIdParam, pathParam("attendeeId", "Attendee id")], ok: { description: "Attendee", schema: dataSchema("Attendee") }, notFound: true,
      }),
    },
    "/events/{id}/attendees/{attendeeId}/approve": {
      post: write({
        tags: ["Attendees"], operationId: "approveAttendee", summary: "Approve a pending registration",
        description: "Tickets are issued right away for free and paid orders; on an order still awaiting payment they follow the payment. No request body.",
        parameters: [eventIdParam, pathParam("attendeeId", "Attendee id")], ok: { description: "Approved attendee", schema: dataSchema("Attendee") }, notFound: true, conflict: "The attendee is not pending approval.",
      }),
    },
    "/events/{id}/attendees/{attendeeId}/reject": {
      post: write({
        tags: ["Attendees"], operationId: "rejectAttendee", summary: "Reject a pending registration",
        description: "The seat is returned and a rejection email queued. Paid orders are refunded separately. No request body.",
        parameters: [eventIdParam, pathParam("attendeeId", "Attendee id")], ok: { description: "Rejected attendee", schema: dataSchema("Attendee") }, notFound: true, conflict: "The attendee is not pending approval.",
      }),
    },
    "/events/{id}/attendees/{attendeeId}/cancel": {
      post: write({
        tags: ["Attendees"], operationId: "cancelAttendee", summary: "Cancel a confirmed or pending attendee",
        description: "The ticket is revoked and the seat returned. No email is sent. No request body.",
        parameters: [eventIdParam, pathParam("attendeeId", "Attendee id")], ok: { description: "Cancelled attendee", schema: dataSchema("Attendee") }, notFound: true, conflict: "The attendee is neither confirmed nor pending.",
      }),
    },

    "/events/{id}/check-ins": {
      get: read({
        tags: ["Check-ins"], operationId: "listCheckIns", summary: "List active check-ins",
        parameters: [eventIdParam, ...pageParams()], ok: { description: "Check-ins, newest first (undone ones excluded)", schema: listSchema("CheckIn") }, notFound: true, validation: true,
      }),
      post: write({
        tags: ["Check-ins"], operationId: "checkIn", summary: "Check a ticket in",
        description: "By ticket id or by the QR `token` (raw token or the full ticket URL). Recorded with method `manual`. Never fails for a bad ticket: `outcome` says what happened, and `already` returns the earlier check-in time. Concurrent scans of one ticket yield one check-in.",
        parameters: [eventIdParam], requestBody: { schema: ref("CheckInInput") },
        ok: { description: "Check-in outcome", schema: dataSchema("CheckInResult") }, notFound: true,
      }),
    },
    "/events/{id}/check-ins/{ticketId}": {
      delete: remove({
        tags: ["Check-ins"], operationId: "undoCheckIn", summary: "Undo the active check-in for a ticket",
        description: "404 when the ticket has no active check-in. The audit row is kept with `undoneAt` set.",
        parameters: [eventIdParam, pathParam("ticketId", "Ticket id")],
      }),
    },

    "/events/{id}/discount-codes": {
      get: read({
        tags: ["Discount codes"], operationId: "listDiscountCodes", summary: "List discount codes",
        parameters: [eventIdParam, ...pageParams()], ok: { description: "Codes, newest first", schema: listSchema("DiscountCode") }, notFound: true, validation: true,
      }),
      post: write({
        tags: ["Discount codes"], operationId: "createDiscountCode", summary: "Create a discount code",
        parameters: [eventIdParam], requestBody: { schema: ref("DiscountCodeInput") },
        ok: { status: "201", description: "Code created", schema: dataSchema("DiscountCode") }, notFound: true, conflict: "The code already exists for this event.",
      }),
    },
    "/events/{id}/discount-codes/{codeId}": {
      delete: remove({ tags: ["Discount codes"], operationId: "deleteDiscountCode", summary: "Delete a discount code", parameters: [eventIdParam, pathParam("codeId", "Discount code id")] }),
    },

    "/events/{id}/waitlist": {
      get: read({
        tags: ["Waitlist"], operationId: "listWaitlist", summary: "List waitlist entries",
        parameters: [eventIdParam, ...pageParams()], ok: { description: "Entries, oldest first, with their derived status", schema: listSchema("WaitlistEntry") }, notFound: true, validation: true,
      }),
    },
    "/events/{id}/waitlist/{entryId}": {
      delete: remove({
        tags: ["Waitlist"], operationId: "deleteWaitlistEntry", summary: "Remove a waitlist entry",
        description: "An open offer gives its held seat back.", parameters: [eventIdParam, pathParam("entryId", "Waitlist entry id")],
      }),
    },
    "/events/{id}/waitlist/{entryId}/promote": {
      post: write({
        tags: ["Waitlist"], operationId: "promoteWaitlistEntry", summary: "Offer a seat to a waitlist entry",
        description: "Holds one seat on the ticket type for 24 hours (counted against capacity) and mints the claim link. Unlike the dashboard, the API does not email the person: send them `offerUrl`. A lapsed offer releases the seat and the entry can be promoted again.",
        parameters: [eventIdParam, pathParam("entryId", "Waitlist entry id")], requestBody: { schema: ref("PromoteWaitlistInput") },
        ok: { description: "Seat held and claim link minted", schema: dataSchema("WaitlistOffer") }, notFound: true, conflict: "The person already has an open offer or already registered, or no seat is free.",
      }),
    },

    "/events/{id}/invites": {
      get: read({
        tags: ["Invites"], operationId: "listInvites", summary: "List invite links",
        parameters: [eventIdParam, ...pageParams()], ok: { description: "Invites, newest first, with their link and derived status", schema: listSchema("Invite") }, notFound: true, validation: true,
      }),
      post: write({
        tags: ["Invites"], operationId: "createInvite", summary: "Create an invite link",
        description: "Optionally bound to one email (the registrant must use that address) with a use budget and expiry. The API does not send the invitation: share `url`. Members of the organization never need an invite.",
        parameters: [eventIdParam], requestBody: { schema: ref("InviteInput") },
        ok: { status: "201", description: "Invite created", schema: dataSchema("Invite") }, notFound: true,
      }),
    },
    "/events/{id}/invites/{inviteId}": {
      delete: remove({ tags: ["Invites"], operationId: "deleteInvite", summary: "Revoke an invite link", parameters: [eventIdParam, pathParam("inviteId", "Invite id")] }),
    },

    "/webhooks": {
      get: read({
        tags: ["Webhooks"], operationId: "listWebhooks", summary: "List webhook subscriptions",
        parameters: pageParams(), ok: { description: "Webhooks, newest first (secrets never included)", schema: listSchema("Webhook") }, validation: true,
      }),
      post: write({
        tags: ["Webhooks"], operationId: "createWebhook", summary: "Subscribe an endpoint to events",
        description: "The signing `secret` is returned in this response only. Deliveries carry `evnelo-signature` (hex HMAC-SHA256 of `{timestamp}.{body}`), `evnelo-timestamp` (unix seconds) and `evnelo-delivery-id`, and are retried with backoff.",
        requestBody: { schema: ref("WebhookInput") },
        ok: { status: "201", description: "Webhook created, with its secret", schema: dataSchema("WebhookWithSecret") },
      }),
    },
    "/webhooks/{id}": {
      get: read({ tags: ["Webhooks"], operationId: "getWebhook", summary: "Get a webhook", parameters: [pathParam("id", "Webhook id")], ok: { description: "Webhook", schema: dataSchema("Webhook") }, notFound: true }),
      patch: write({
        tags: ["Webhooks"], operationId: "updateWebhook", summary: "Update a webhook",
        description: "Change the URL or subscribed events, or pause and resume with `active`.",
        parameters: [pathParam("id", "Webhook id")], requestBody: { schema: ref("UpdateWebhookInput") },
        ok: { description: "Updated webhook", schema: dataSchema("Webhook") }, notFound: true,
      }),
      delete: remove({ tags: ["Webhooks"], operationId: "deleteWebhook", summary: "Delete a webhook", parameters: [pathParam("id", "Webhook id")] }),
    },
    "/webhooks/{id}/rotate-secret": {
      post: write({
        tags: ["Webhooks"], operationId: "rotateWebhookSecret", summary: "Rotate the signing secret",
        description: "The previous secret stops verifying immediately; the new one is returned once. No request body.",
        parameters: [pathParam("id", "Webhook id")], ok: { description: "New secret", schema: dataSchema("WebhookSecret") }, notFound: true,
      }),
    },
    "/webhooks/{id}/deliveries": {
      get: read({
        tags: ["Webhooks"], operationId: "listWebhookDeliveries", summary: "List recent deliveries of a webhook",
        parameters: [pathParam("id", "Webhook id"), ...pageParams()], ok: { description: "Deliveries, newest first, with attempts, last response status and state", schema: listSchema("WebhookDelivery") }, notFound: true, validation: true,
      }),
    },
    "/webhook-events": {
      get: read({
        tags: ["Webhooks"], operationId: "listWebhookEvents", summary: "List the event types a webhook can subscribe to",
        ok: { description: "Event types", schema: { type: "object", required: ["data"], properties: { data: { type: "array", items: ref("WebhookEventType") } } } },
      }),
    },

    "/openapi.json": {
      get: {
        tags: ["Meta"], operationId: "getOpenApiDocument", summary: "This document", security: [],
        responses: { "200": { description: "OpenAPI 3.1 document", content: { "application/json": { schema: { type: "object" } } } } },
      },
    },
    "/docs": {
      get: {
        tags: ["Meta"], operationId: "getApiDocs", summary: "Interactive API reference (HTML)", security: [],
        responses: { "200": { description: "Scalar API reference", content: { "text/html": { schema: { type: "string" } } } } },
      },
    },
  },
  components: {
    headers: {
      RateLimitLimit: { description: "Maximum requests allowed in the current one-minute window.", schema: { type: "integer" } },
      RateLimitRemaining: { description: "Requests remaining in the current window.", schema: { type: "integer" } },
      RateLimitReset: { description: "Unix time (seconds) when the current window resets.", schema: { type: "integer" } },
    },
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "ev_live_*", description: "Organization-scoped API key with read or write scope. Keys are SHA-256 hashed at rest and shown once at creation." },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string", enum: ["unauthorized", "forbidden", "not_found", "conflict", "validation_error", "invalid_json", "payload_too_large", "unsupported_media_type", "idempotency_conflict", "idempotency_in_progress", "rate_limit_exceeded", "internal_error"] },
          message: { type: "string" },
          issues: { type: "array", description: "zod issues on validation failures.", items: { type: "object", properties: { path: { type: "array", items: { type: ["string", "integer"] } }, message: { type: "string" }, code: { type: "string" } } } },
        },
      },
      ErrorResponse: { type: "object", required: ["error"], properties: { error: ref("Error") } },
      Pagination: { type: "object", required: ["limit", "offset", "nextOffset"], properties: { limit: { type: "integer" }, offset: { type: "integer" }, nextOffset: { type: ["integer", "null"], description: "Offset of the next page, or null on the last page." } } },
      DeletedResponse: { type: "object", required: ["data"], properties: { data: { type: "object", required: ["id", "deleted"], properties: { id: { type: "string" }, deleted: { type: "boolean", const: true } } } } },

      SocialLink: {
        type: "object", additionalProperties: false, required: ["platform", "url"],
        properties: { platform: { type: "string", enum: SOCIAL_PLATFORMS }, url: { type: "string", format: "uri" } },
      },
      Host: {
        type: "object", additionalProperties: false, required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 }, title: { type: ["string", "null"], maxLength: 120 },
          avatarUrl: nullableHttpUrl(500),
          socialLinks: { type: "array", items: ref("SocialLink"), default: [] },
        },
      },
      Sponsor: {
        type: "object", additionalProperties: false, required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 }, logoUrl: nullableHttpUrl(500),
          tier: { type: ["string", "null"], maxLength: 60 }, website: nullableHttpUrl(300),
          socialLinks: { type: "array", items: ref("SocialLink"), default: [] },
        },
      },

      Organization: {
        type: "object",
        required: ["id", "slug", "name", "logoUrl", "website", "accentColor", "socialLinks", "stripeChargesEnabled", "feePassThrough", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, slug: { type: "string" }, name: { type: "string" }, logoUrl: { type: ["string", "null"] }, website: { type: ["string", "null"] },
          accentColor: { type: ["string", "null"], description: "#rrggbb" }, socialLinks: { type: "array", items: ref("SocialLink") },
          stripeChargesEnabled: { type: "boolean", description: "Whether the organization can take paid orders." }, feePassThrough: { type: "boolean", description: "Default for new events: buyers pay the service fee." },
          createdAt: dateTime, updatedAt: dateTime,
        },
        examples: [{ id: exampleEvent.organizationId, slug: "demo", name: "Demo Collective", logoUrl: null, website: "https://demo.example.com", accentColor: "#1f7a4d", socialLinks: [], stripeChargesEnabled: false, feePassThrough: false, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" }],
      },
      UpdateOrganizationInput: {
        type: "object", description: "Unknown properties are ignored.",
        properties: {
          name: { type: "string", minLength: 2, maxLength: 120 }, slug: { type: "string", pattern: "^[a-z0-9-]{3,60}$", description: "Reserved words (api, dashboard, …) are refused." },
          website: { type: "string", maxLength: 300, description: "http(s) URL; a bare domain is normalized; empty string clears." },
          logoUrl: { type: "string", maxLength: 500, description: "URL; empty string clears." }, accentColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$", description: "Empty string clears." },
          socialLinks: { type: "array", items: { type: "object", required: ["platform", "url"], properties: { platform: { type: "string" }, url: { type: "string", format: "uri" } } } },
          feePassThrough: { type: "boolean" },
        },
      },

      PublicEvent: {
        type: "object",
        required: ["id", "slug", "name", "startsAt", "endsAt", "timezone", "locationType", "organizationId", "orgName", "orgSlug", "isFree"],
        properties: {
          id: { type: "string" }, slug: { type: "string" }, name: { type: "string" }, descriptionMd: { type: ["string", "null"] },
          coverImageUrl: { type: ["string", "null"], format: "uri" }, startsAt: dateTime, endsAt: dateTime,
          timezone: { type: "string" }, city: { type: ["string", "null"] }, country: { type: ["string", "null"] }, locationType: { type: "string" },
          venueName: { type: ["string", "null"] }, organizationId: { type: "string" }, orgName: { type: "string" }, orgSlug: { type: "string" },
          isFree: { type: "boolean", description: "True when every visible ticket type costs nothing." },
          minPriceMinor: { type: ["integer", "null"], description: "Cheapest visible ticket price in minor units, null when the event has no visible ticket type." },
          currency: { type: ["string", "null"], description: "ISO currency of minPriceMinor." },
          distanceKm: { type: ["number", "null"], description: "Great-circle distance from the lat/lng origin, null when none was given." },
        },
      },
      Event: {
        type: "object",
        required: ["id", "organizationId", "slug", "name", "status", "timezone", "startsAt", "endsAt", "locationType", "visibility", "requiresApproval", "guestsEnabled", "maxGuests", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, organizationId: { type: "string" }, slug: { type: "string", description: "Unique within the organization; the public page is /{orgSlug}/{slug}." }, name: { type: "string" }, descriptionMd: { type: ["string", "null"] },
          coverImageUrl: { type: ["string", "null"] }, logoUrl: { type: ["string", "null"] }, timezone: { type: "string" },
          startsAt: dateTime, endsAt: dateTime,
          locationType: { type: "string", enum: ["in_person", "online", "hybrid"] }, venueName: { type: ["string", "null"] }, address: { type: ["string", "null"] }, city: { type: ["string", "null"] }, country: { type: ["string", "null"] },
          lat: { type: ["string", "null"] }, lng: { type: ["string", "null"] }, onlineUrl: { type: ["string", "null"] },
          visibility: { type: "string", enum: ["public", "unlisted", "private"] }, status: { type: "string", enum: ["draft", "published", "cancelled", "ended"] },
          requiresApproval: { type: "boolean" }, capacity: { type: ["integer", "null"] }, waitlistEnabled: { type: "boolean" }, collectPhone: { type: "boolean" },
          guestsEnabled: { type: "boolean" }, maxGuests: { type: "integer" }, feePassThrough: { type: "boolean" }, refundPolicy: { type: ["string", "null"] },
          socialLinks: { type: "array", items: ref("SocialLink") }, reminderHours: { type: "array", items: { type: "integer" } },
          publishedAt: nullableDateTime, deletedAt: nullableDateTime,
          createdAt: dateTime, updatedAt: dateTime,
        },
        examples: [exampleEvent],
      },
      CreateEventInput: {
        type: "object",
        description: "Unknown properties are ignored. `country` is upper-cased before validation.",
        required: ["name", "timezone", "startsAt", "endsAt"],
        properties: eventInputProperties,
      },
      UpdateEventInput: {
        type: "object",
        description: "Any subset of the event's fields. Arrays (`tags`, `hosts`, `sponsors`, `socialLinks`, `reminderHours`) replace the stored list.",
        properties: eventInputProperties,
      },
      EventListItem: { type: "object", required: ["event", "registrations", "pending", "revenue", "checkedIn"], properties: { event: ref("Event"), registrations: { type: "integer", description: "Confirmed attendees." }, pending: { type: "integer", description: "Attendees awaiting approval." }, revenue: money("Paid minus refunded."), checkedIn: { type: "integer" } } },
      EventListResponse: listSchema("EventListItem"),
      EventResponse: dataSchema("Event"),
      EventDetailsResponse: {
        type: "object", required: ["data"],
        properties: { data: { type: "object", required: ["event", "ticketTypes", "hosts", "sponsors", "tags", "registrationFields"], properties: {
          event: ref("Event"), ticketTypes: { type: "array", items: ref("TicketType") },
          hosts: { type: "array", items: ref("Host") }, sponsors: { type: "array", items: ref("Sponsor") },
          tags: { type: "array", items: { type: "object", required: ["name", "slug"], properties: { name: { type: "string" }, slug: { type: "string" } } } },
          registrationFields: { type: "array", items: ref("RegistrationField") },
        } } },
      },
      EventStats: {
        type: "object", required: ["registrations", "pending", "revenue", "checkedIn", "currency", "byTicketType", "byDay"],
        properties: {
          registrations: { type: "integer" }, pending: { type: "integer" }, revenue: money("Paid minus refunded."), checkedIn: { type: "integer" }, currency: { type: "string" },
          byTicketType: { type: "array", items: { type: "object", required: ["id", "name", "priceMinor", "currency", "sold", "held", "quantity"], properties: { id: { type: "string" }, name: { type: "string" }, priceMinor: { type: "integer" }, currency: { type: "string" }, sold: { type: "integer" }, held: { type: "integer" }, quantity: { type: ["integer", "null"] } } } },
          byDay: { type: "array", description: "Live registrations per calendar day (UTC).", items: { type: "object", required: ["day", "count"], properties: { day: { type: "string", format: "date" }, count: { type: "integer" } } } },
        },
      },

      TicketType: {
        type: "object",
        required: ["id", "eventId", "name", "priceMinor", "currency", "sold", "held", "minPerOrder", "maxPerOrder", "hidden", "taxRateBps", "position", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, eventId: { type: "string" }, name: { type: "string" }, description: { type: ["string", "null"] }, priceMinor: money("Price per ticket."), currency: { type: "string" },
          quantity: { type: ["integer", "null"], description: "null = unlimited." }, sold: { type: "integer" }, held: { type: "integer", description: "Seats in pending checkouts and open waitlist offers." }, minPerOrder: { type: "integer" }, maxPerOrder: { type: "integer" },
          salesStartAt: nullableDateTime, salesEndAt: nullableDateTime, hidden: { type: "boolean" }, accessCode: { type: ["string", "null"] }, taxRateBps: { type: "integer" }, position: { type: "integer" },
          createdAt: dateTime, updatedAt: dateTime,
        },
        examples: [exampleTicketType],
      },
      TicketTypeInput: { type: "object", description: "Unknown properties are ignored.", required: ["name", "priceMinor"], properties: ticketTypeInputProperties },
      UpdateTicketTypeInput: { type: "object", description: "Any subset of the ticket type's fields.", properties: ticketTypeInputProperties },

      ConditionRule: {
        type: "object", required: ["fieldKey", "op"],
        properties: { fieldKey: { type: "string", description: "Key of an earlier field in the same scope." }, op: { type: "string", enum: ["eq", "neq", "contains", "empty", "not_empty"] }, value: { type: "string" } },
      },
      ConditionGroup: { type: "object", required: ["op", "rules"], properties: { op: { type: "string", enum: ["and", "or"] }, rules: { type: "array", minItems: 1, maxItems: 5, items: ref("ConditionRule") } } },
      FieldOption: { type: "object", required: ["value", "label"], properties: { value: { type: "string", minLength: 1, maxLength: 100 }, label: { type: "string", minLength: 1, maxLength: 160 } } },
      RegistrationField: {
        type: "object",
        required: ["id", "eventId", "key", "label", "type", "required", "scope", "position"],
        properties: {
          id: { type: "string" }, eventId: { type: "string" }, key: { type: "string" }, label: { type: "string" }, helpText: { type: ["string", "null"] }, placeholder: { type: ["string", "null"] },
          type: { type: "string", enum: ["short_text", "long_text", "email", "phone", "number", "select", "multi_select", "checkbox", "date", "url", "file", "consent"] },
          options: { type: ["array", "null"], items: ref("FieldOption") },
          required: { type: "boolean" }, scope: { type: "string", enum: ["order", "attendee", "guest"] }, ticketTypeIds: { type: ["array", "null"], items: { type: "string" }, description: "null = shown for every ticket type." },
          condition: { oneOf: [ref("ConditionGroup"), { type: "null" }] }, position: { type: "integer" },
        },
      },
      RegistrationFieldInput: {
        type: "object", required: ["key", "label", "type"],
        properties: {
          id: { ...ulid, description: "Existing field id to update in place; omit to create." },
          key: { type: "string", pattern: "^[a-z0-9_]{1,60}$", description: "Answer key; unique within the form." }, label: { type: "string", minLength: 1, maxLength: 160 },
          helpText: nullableText(300), placeholder: nullableText(120),
          type: { type: "string", enum: ["short_text", "long_text", "email", "phone", "number", "select", "multi_select", "checkbox", "date", "url", "file", "consent"] },
          options: { type: ["array", "null"], maxItems: 50, items: ref("FieldOption"), description: "Required for select and multi_select." },
          required: { type: "boolean", default: false }, scope: { type: "string", enum: ["order", "attendee", "guest"], default: "attendee" },
          ticketTypeIds: { type: ["array", "null"], items: ulid }, condition: { oneOf: [ref("ConditionGroup"), { type: "null" }] },
        },
      },

      Order: {
        type: "object",
        required: ["id", "eventId", "organizationId", "email", "status", "currency", "subtotalMinor", "discountMinor", "taxMinor", "serviceFeeMinor", "totalMinor", "platformFeeMinor", "refundedMinor", "answers", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, eventId: { type: "string" }, organizationId: { type: "string" }, userId: { type: ["string", "null"] }, email: { type: "string" },
          status: { type: "string", enum: ["pending", "processing", "paid", "free", "refunded", "partially_refunded", "failed", "expired"] }, currency: { type: "string" },
          subtotalMinor: money("Ticket prices before discount."), discountMinor: money("Discount applied."), taxMinor: money("Tax."), serviceFeeMinor: money("Service fee shown to the buyer when passed through."),
          totalMinor: money("Amount charged."), platformFeeMinor: money("Platform fee (Cloud edition)."), refundedMinor: money("Refunded so far."),
          discountCodeId: { type: ["string", "null"] }, stripePaymentIntentId: { type: ["string", "null"] }, stripeAccountId: { type: ["string", "null"], description: "Connected account the payment lives on (Cloud)." },
          holdExpiresAt: { ...nullableDateTime, description: "Seat hold deadline while pending." }, paidAt: nullableDateTime,
          answers: { type: "object", additionalProperties: true, description: "Answers to order-scope registration fields." },
          createdAt: dateTime, updatedAt: dateTime,
        },
        examples: [exampleOrder],
      },
      OrderListItem: { allOf: [ref("Order"), { type: "object", required: ["attendeeCount", "buyerName"], properties: { attendeeCount: { type: "integer" }, buyerName: { type: ["string", "null"], description: "Name of the first non-guest attendee." } } }] },
      OrderItem: { type: "object", required: ["id", "ticketTypeId", "ticketTypeName", "quantity", "unitPriceMinor"], properties: { id: { type: "string" }, ticketTypeId: { type: "string" }, ticketTypeName: { type: "string" }, quantity: { type: "integer" }, unitPriceMinor: money("Unit price at purchase.") } },
      OrderDetails: { allOf: [ref("Order"), { type: "object", required: ["items", "attendees"], properties: { items: { type: "array", items: ref("OrderItem") }, attendees: { type: "array", items: ref("Attendee") } } }] },
      RefundRequested: { type: "object", required: ["orderId", "status", "refund"], properties: { orderId: { type: "string" }, status: { type: "string", description: "Order status at the time of the request." }, refund: { type: "string", const: "requested" } } },

      AttendeeTicket: {
        type: "object", required: ["id", "token", "url", "revokedAt", "checkedInAt"],
        properties: { id: { type: "string" }, token: { type: "string", description: "The QR payload; also accepted by the check-in endpoint." }, url: { type: "string", format: "uri", description: "Ticket page." }, revokedAt: nullableDateTime, checkedInAt: { ...nullableDateTime, description: "Active check-in time, null when not checked in." } },
      },
      Attendee: {
        type: "object",
        required: ["id", "eventId", "orderId", "ticketTypeId", "guestOfAttendeeId", "name", "email", "status", "answers", "createdAt", "updatedAt", "ticketTypeName", "hostName", "order", "ticket"],
        properties: {
          id: { type: "string" }, eventId: { type: "string" }, orderId: { type: "string" }, ticketTypeId: { type: "string" }, userId: { type: ["string", "null"] },
          guestOfAttendeeId: { type: ["string", "null"], description: "Set on +1 guests; null on the person who registered." },
          name: { type: "string" }, email: { type: "string" }, phone: { type: ["string", "null"], description: "E.164." }, smsOptIn: { type: "boolean" }, remindersOptOut: { type: "boolean" },
          status: { type: "string", enum: ["pending_approval", "confirmed", "rejected", "cancelled", "waitlisted"] },
          answers: { type: "object", additionalProperties: true, description: "Answers to attendee-scope (or guest-scope) registration fields." },
          deletedAt: nullableDateTime, createdAt: dateTime, updatedAt: dateTime,
          ticketTypeName: { type: "string" }, hostName: { type: ["string", "null"], description: "For guests: the host's name." },
          order: { type: "object", required: ["id", "status", "totalMinor", "currency"], properties: { id: { type: "string" }, status: { type: "string" }, totalMinor: money("Order total."), currency: { type: "string" } } },
          ticket: { oneOf: [ref("AttendeeTicket"), { type: "null" }], description: "null until a ticket is issued (pending approval or unpaid order)." },
        },
        examples: [exampleAttendee],
      },

      CheckInInput: {
        type: "object", description: "One of ticketId or token.",
        properties: { ticketId: ulid, token: { type: "string", minLength: 1, maxLength: 2048, description: "QR payload: the raw token or the ticket URL." } },
      },
      CheckInAttendee: {
        type: "object", required: ["ticketId", "attendeeId", "name", "email", "ticketTypeName", "hostName", "checkedInAt"],
        properties: { ticketId: { type: "string" }, attendeeId: { type: "string" }, name: { type: "string" }, email: { type: "string" }, ticketTypeName: { type: "string" }, hostName: { type: ["string", "null"] }, checkedInAt: nullableDateTime },
      },
      CheckInResult: {
        type: "object", required: ["outcome", "attendee", "checkedInAt"],
        properties: {
          outcome: { type: "string", enum: ["ok", "already", "not_found", "revoked", "not_confirmed", "wrong_event"], description: "ok = checked in now; already = was checked in (see checkedInAt); the rest refuse entry." },
          attendee: { oneOf: [ref("CheckInAttendee"), { type: "null" }] }, checkedInAt: nullableDateTime,
        },
      },
      CheckIn: {
        type: "object", required: ["id", "ticketId", "attendeeId", "name", "email", "ticketTypeName", "method", "checkedInAt"],
        properties: { id: { type: "string" }, ticketId: { type: "string" }, attendeeId: { type: "string" }, name: { type: "string" }, email: { type: "string" }, ticketTypeName: { type: "string" }, method: { type: "string", enum: ["scan", "manual"] }, checkedInAt: dateTime },
      },

      DiscountCode: {
        type: "object", required: ["id", "eventId", "code", "kind", "value", "maxUses", "uses", "expiresAt", "createdAt"],
        properties: {
          id: { type: "string" }, eventId: { type: "string" }, code: { type: "string" }, kind: { type: "string", enum: ["percent", "fixed"] },
          value: { type: "integer", description: "Percent (1–100) or minor units for fixed." }, maxUses: { type: ["integer", "null"] }, uses: { type: "integer" }, expiresAt: nullableDateTime, createdAt: dateTime,
        },
      },
      DiscountCodeInput: {
        type: "object", required: ["code", "kind", "value"],
        properties: {
          code: { type: "string", pattern: "^[A-Za-z0-9_-]{3,40}$", description: "Upper-cased on save." }, kind: { type: "string", enum: ["percent", "fixed"] },
          value: { type: "integer", minimum: 1, description: "Percent (max 100) or minor units." }, maxUses: { type: ["integer", "null"], minimum: 1, maximum: 1000000 }, expiresAt: nullableDateTime,
        },
      },

      WaitlistEntry: {
        type: "object", required: ["id", "eventId", "ticketTypeId", "email", "name", "promotedAt", "holdExpiresAt", "expiredAt", "registeredAt", "orderId", "createdAt", "ticketTypeName", "status"],
        properties: {
          id: { type: "string" }, eventId: { type: "string" }, ticketTypeId: { type: ["string", "null"], description: "Set once promoted: the seat being held." }, email: { type: "string" }, name: { type: ["string", "null"] },
          promotedAt: nullableDateTime, holdExpiresAt: nullableDateTime, expiredAt: nullableDateTime, registeredAt: nullableDateTime, orderId: { type: ["string", "null"] }, createdAt: dateTime,
          ticketTypeName: { type: ["string", "null"] }, status: { type: "string", enum: ["waiting", "offered", "registered", "expired"] },
        },
      },
      PromoteWaitlistInput: { type: "object", required: ["ticketTypeId"], properties: { ticketTypeId: ulid } },
      WaitlistOffer: { allOf: [ref("WaitlistEntry"), { type: "object", required: ["offerUrl"], properties: { offerUrl: { type: "string", format: "uri", description: "Claim link, valid until holdExpiresAt." } } }] },

      Invite: {
        type: "object", required: ["id", "eventId", "email", "token", "maxUses", "uses", "expiresAt", "createdAt", "url", "status"],
        properties: {
          id: { type: "string" }, eventId: { type: "string" }, email: { type: ["string", "null"], description: "When set, only this address can register with the link." }, token: { type: "string" },
          maxUses: { type: "integer" }, uses: { type: "integer" }, expiresAt: nullableDateTime, createdAt: dateTime,
          url: { type: "string", format: "uri", description: "The /i/{token} link to share." }, status: { type: "string", enum: ["valid", "expired", "exhausted"] },
        },
      },
      InviteInput: {
        type: "object",
        properties: { email: { type: "string", format: "email", maxLength: 255, description: "Bind the link to one address; empty or absent = shareable." }, maxUses: { type: "integer", minimum: 1, maximum: 10000, default: 1 }, expiresInDays: { type: ["integer", "null"], minimum: 1, maximum: 365 } },
      },

      WebhookEventType: { type: "string", enum: WEBHOOK_EVENTS },
      Webhook: {
        type: "object", required: ["id", "organizationId", "url", "events", "active", "createdAt"],
        properties: { id: { type: "string" }, organizationId: { type: "string" }, url: { type: "string", format: "uri" }, events: { type: "array", items: ref("WebhookEventType") }, active: { type: "boolean" }, createdAt: dateTime },
        examples: [exampleWebhook],
      },
      WebhookWithSecret: { allOf: [ref("Webhook"), { type: "object", required: ["secret"], properties: { secret: { type: "string", description: "HMAC key, shown once. Store it." } } }] },
      WebhookSecret: { type: "object", required: ["id", "secret"], properties: { id: { type: "string" }, secret: { type: "string" } } },
      WebhookInput: {
        type: "object", required: ["url", "events"],
        properties: { url: { type: "string", format: "uri", maxLength: 500, description: "https:// (http://localhost allowed for development)." }, events: { type: "array", minItems: 1, items: ref("WebhookEventType") }, active: { type: "boolean", default: true } },
      },
      UpdateWebhookInput: {
        type: "object",
        properties: { url: { type: "string", format: "uri", maxLength: 500 }, events: { type: "array", minItems: 1, items: ref("WebhookEventType") }, active: { type: "boolean" } },
      },
      WebhookDelivery: {
        type: "object", required: ["id", "webhookId", "event", "payload", "attempts", "nextAttemptAt", "responseStatus", "deliveredAt", "createdAt", "state"],
        properties: {
          id: { type: "string" }, webhookId: { type: "string" }, event: ref("WebhookEventType"),
          payload: { type: "object", required: ["id", "type", "createdAt", "organizationId", "data"], properties: { id: { type: "string" }, type: ref("WebhookEventType"), createdAt: dateTime, organizationId: { type: "string" }, data: {} }, description: "The envelope that was (or will be) POSTed." },
          attempts: { type: "integer" }, nextAttemptAt: nullableDateTime, responseStatus: { type: ["integer", "null"] }, deliveredAt: nullableDateTime, createdAt: dateTime,
          state: { type: "string", enum: ["pending", "retrying", "delivered", "failed"] },
        },
      },

      PublicEventListResponse: listSchema("PublicEvent"),
    },
    responses: {
      Unauthorized: { description: "Missing, revoked, or invalid API key", content: jsonContent(ref("ErrorResponse")) },
      Forbidden: { description: "API key lacks the required scope", content: jsonContent(ref("ErrorResponse")) },
      BadRequest: { description: "The request body is not valid JSON", headers: rateLimitResponseHeaders, content: jsonContent(ref("ErrorResponse")) },
      NotFound: { description: "Resource not found in the API key organization", headers: rateLimitResponseHeaders, content: jsonContent(ref("ErrorResponse")) },
      ValidationError: { description: "Request validation failed", headers: rateLimitResponseHeaders, content: jsonContent(ref("ErrorResponse")) },
      IdempotencyConflict: { description: "The idempotency key is in progress or was used for a different request", headers: rateLimitResponseHeaders, content: jsonContent(ref("ErrorResponse")) },
      PayloadTooLarge: { description: "The request body exceeds 256 KiB", headers: rateLimitResponseHeaders, content: jsonContent(ref("ErrorResponse")) },
      UnsupportedMediaType: { description: "Content-Type must be application/json", headers: rateLimitResponseHeaders, content: jsonContent(ref("ErrorResponse")) },
      RateLimited: { description: "Request limit exceeded", headers: { "Retry-After": { schema: { type: "integer" } }, ...rateLimitResponseHeaders }, content: jsonContent(ref("ErrorResponse")) },
      InternalError: { description: "Unexpected server error", headers: rateLimitResponseHeaders, content: jsonContent(ref("ErrorResponse")) },
    },
  },
} as const;
