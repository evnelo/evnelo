import { SOCIAL_PLATFORMS } from "@ot/core";

const jsonContent = (schema: Record<string, unknown>) => ({ "application/json": { schema } });
const rateLimitResponseHeaders = {
  "X-RateLimit-Limit": { $ref: "#/components/headers/RateLimitLimit" },
  "X-RateLimit-Remaining": { $ref: "#/components/headers/RateLimitRemaining" },
  "X-RateLimit-Reset": { $ref: "#/components/headers/RateLimitReset" },
} as const;

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "OpenTicket API",
    version: "1.0.0",
    description: "Versioned JSON API for OpenTicket. Organization endpoints use scoped API keys; public discovery does not require authentication.",
  },
  servers: [{ url: "/api/v1" }],
  tags: [
    { name: "Public", description: "Unauthenticated discovery of published public events." },
    { name: "Events", description: "Organization-scoped event management." },
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
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 48 } },
        ],
        responses: {
          "200": { description: "Matching events", headers: rateLimitResponseHeaders, content: jsonContent({ $ref: "#/components/schemas/PublicEventListResponse" }) },
          "422": { $ref: "#/components/responses/ValidationError" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/events": {
      get: {
        tags: ["Events"],
        operationId: "listEvents",
        summary: "List events belonging to the API key organization",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["draft", "published", "cancelled", "ended"] } }],
        responses: {
          "200": { description: "Organization events", headers: rateLimitResponseHeaders, content: jsonContent({ $ref: "#/components/schemas/EventListResponse" }) },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "422": { $ref: "#/components/responses/ValidationError" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
      post: {
        tags: ["Events"],
        operationId: "createEvent",
        summary: "Create a draft event",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "Idempotency-Key", in: "header", schema: { type: "string", minLength: 1, maxLength: 120 }, description: "Optional key retained for 24 hours. Replays return the original response." }],
        requestBody: { required: true, content: jsonContent({ $ref: "#/components/schemas/CreateEventInput" }) },
        responses: {
          "201": {
            description: "Event created",
            headers: {
              ...rateLimitResponseHeaders,
              "Idempotency-Replayed": { schema: { type: "string", enum: ["true"] }, description: "Present when the original response was replayed." },
            },
            content: jsonContent({ $ref: "#/components/schemas/EventResponse" }),
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "409": { $ref: "#/components/responses/IdempotencyConflict" },
          "413": { $ref: "#/components/responses/PayloadTooLarge" },
          "415": { $ref: "#/components/responses/UnsupportedMediaType" },
          "422": { $ref: "#/components/responses/ValidationError" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/events/{id}": {
      get: {
        tags: ["Events"],
        operationId: "getEvent",
        summary: "Get an event and its ticket types, tags, hosts, sponsors, and registration fields",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", minLength: 26, maxLength: 26 } }],
        responses: {
          "200": { description: "Event details", headers: rateLimitResponseHeaders, content: jsonContent({ $ref: "#/components/schemas/EventDetailsResponse" }) },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
  },
  components: {
    headers: {
      RateLimitLimit: { description: "Maximum requests allowed in the current one-minute window.", schema: { type: "integer" } },
      RateLimitRemaining: { description: "Requests remaining in the current window.", schema: { type: "integer" } },
      RateLimitReset: { description: "UTC time when the current window resets.", schema: { type: "string", format: "date-time" } },
    },
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "ot_live_*", description: "Organization-scoped API key with read or write scope." },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["code", "message"],
        properties: { code: { type: "string" }, message: { type: "string" }, issues: { type: "array", items: {} } },
      },
      ErrorResponse: { type: "object", required: ["error"], properties: { error: { $ref: "#/components/schemas/Error" } } },
      SocialLink: {
        type: "object", additionalProperties: false, required: ["platform", "url"],
        properties: { platform: { type: "string", enum: SOCIAL_PLATFORMS }, url: { type: "string", format: "uri" } },
      },
      Host: {
        type: "object", additionalProperties: false, required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 }, title: { type: ["string", "null"], maxLength: 120 },
          avatarUrl: { type: ["string", "null"], format: "uri", maxLength: 500 },
          socialLinks: { type: "array", items: { $ref: "#/components/schemas/SocialLink" }, default: [] },
        },
      },
      Sponsor: {
        type: "object", additionalProperties: false, required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 }, logoUrl: { type: ["string", "null"], format: "uri", maxLength: 500 },
          tier: { type: ["string", "null"], maxLength: 60 }, website: { type: ["string", "null"], format: "uri", maxLength: 300 },
          socialLinks: { type: "array", items: { $ref: "#/components/schemas/SocialLink" }, default: [] },
        },
      },
      PublicEvent: {
        type: "object",
        required: ["id", "slug", "name", "startsAt", "endsAt", "timezone", "locationType", "organizationId", "orgName"],
        properties: {
          id: { type: "string" }, slug: { type: "string" }, name: { type: "string" }, descriptionMd: { type: ["string", "null"] },
          coverImageUrl: { type: ["string", "null"], format: "uri" }, startsAt: { type: "string", format: "date-time" }, endsAt: { type: "string", format: "date-time" },
          timezone: { type: "string" }, city: { type: ["string", "null"] }, country: { type: ["string", "null"] }, locationType: { type: "string" },
          venueName: { type: ["string", "null"] }, organizationId: { type: "string" }, orgName: { type: "string" },
        },
      },
      Event: { type: "object", additionalProperties: true, required: ["id", "organizationId", "slug", "name", "status"], properties: { id: { type: "string" }, organizationId: { type: "string" }, slug: { type: "string" }, name: { type: "string" }, status: { type: "string", enum: ["draft", "published", "cancelled", "ended"] } } },
      CreateEventInput: {
        type: "object",
        additionalProperties: false,
        required: ["name", "timezone", "startsAt", "endsAt"],
        properties: {
          name: { type: "string", minLength: 2, maxLength: 160 }, slug: { type: "string", pattern: "^[a-z0-9-]{3,80}$" }, descriptionMd: { type: ["string", "null"], maxLength: 20000 },
          coverImageUrl: { type: ["string", "null"], format: "uri", maxLength: 500 }, logoUrl: { type: ["string", "null"], format: "uri", maxLength: 500 },
          timezone: { type: "string", minLength: 1, maxLength: 64 }, startsAt: { type: "string", format: "date-time" }, endsAt: { type: "string", format: "date-time" },
          locationType: { type: "string", enum: ["in_person", "online", "hybrid"], default: "in_person" }, venueName: { type: ["string", "null"], maxLength: 160 }, address: { type: ["string", "null"], maxLength: 300 }, city: { type: ["string", "null"], maxLength: 100 }, country: { type: ["string", "null"], pattern: "^[A-Z]{2}$" },
          lat: { type: ["string", "null"], maxLength: 20 }, lng: { type: ["string", "null"], maxLength: 20 }, onlineUrl: { type: ["string", "null"], format: "uri", maxLength: 500 },
          visibility: { type: "string", enum: ["public", "unlisted", "private"], default: "public" }, requiresApproval: { type: "boolean", default: false },
          capacity: { type: ["integer", "null"], minimum: 1 }, waitlistEnabled: { type: "boolean", default: false }, collectPhone: { type: "boolean", default: false },
          guestsEnabled: { type: "boolean", default: false }, maxGuests: { type: "integer", minimum: 1, maximum: 20, default: 1 }, feePassThrough: { type: "boolean", default: false },
          refundPolicy: { type: ["string", "null"], maxLength: 5000 }, socialLinks: { type: "array", items: { $ref: "#/components/schemas/SocialLink" }, default: [] },
          reminderHours: { type: "array", maxItems: 4, items: { type: "integer", minimum: 1, maximum: 336 }, default: [24, 1] },
          tags: { type: "array", maxItems: 10, items: { type: "string", minLength: 1, maxLength: 60 }, default: [] },
          hosts: { type: "array", maxItems: 20, items: { $ref: "#/components/schemas/Host" }, default: [] },
          sponsors: { type: "array", maxItems: 50, items: { $ref: "#/components/schemas/Sponsor" }, default: [] },
        },
      },
      PublicEventListResponse: { type: "object", required: ["data"], properties: { data: { type: "array", items: { $ref: "#/components/schemas/PublicEvent" } } } },
      EventListItem: { type: "object", required: ["event", "registrations", "pending", "revenue", "checkedIn"], properties: { event: { $ref: "#/components/schemas/Event" }, registrations: { type: "integer" }, pending: { type: "integer" }, revenue: { type: "integer" }, checkedIn: { type: "integer" } } },
      EventListResponse: { type: "object", required: ["data"], properties: { data: { type: "array", items: { $ref: "#/components/schemas/EventListItem" } } } },
      EventResponse: { type: "object", required: ["data"], properties: { data: { $ref: "#/components/schemas/Event" } } },
      EventDetailsResponse: { type: "object", required: ["data"], properties: { data: { type: "object", additionalProperties: true, required: ["event", "ticketTypes", "registrationFields"], properties: { event: { $ref: "#/components/schemas/Event" }, ticketTypes: { type: "array", items: { type: "object", additionalProperties: true } }, registrationFields: { type: "array", items: { type: "object", additionalProperties: true } } } } } },
    },
    responses: {
      Unauthorized: { description: "Missing, revoked, or invalid API key", content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }) },
      Forbidden: { description: "API key lacks the required scope", content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }) },
      BadRequest: { description: "The request body is not valid JSON", headers: rateLimitResponseHeaders, content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }) },
      NotFound: { description: "Resource not found in the API key organization", headers: rateLimitResponseHeaders, content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }) },
      ValidationError: { description: "Request validation failed", headers: rateLimitResponseHeaders, content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }) },
      IdempotencyConflict: { description: "The idempotency key is in progress or was used for a different request", headers: rateLimitResponseHeaders, content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }) },
      PayloadTooLarge: { description: "The request body exceeds 256 KiB", headers: rateLimitResponseHeaders, content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }) },
      UnsupportedMediaType: { description: "Content-Type must be application/json", headers: rateLimitResponseHeaders, content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }) },
      RateLimited: { description: "Request limit exceeded", headers: { "Retry-After": { schema: { type: "integer" } }, ...rateLimitResponseHeaders }, content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }) },
      InternalError: { description: "Unexpected server error", headers: rateLimitResponseHeaders, content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }) },
    },
  },
} as const;
