import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openApiDocument } from "./openapi";

const document = openApiDocument as Record<string, any>;
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/** Every route.ts under app/api/v1 with the HTTP methods it exports, keyed by its OpenAPI path. */
function implementedRoutes() {
  const root = path.resolve(__dirname, "../app/api/v1");
  const routes = new Map<string, string[]>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "route.ts") {
        const source = readFileSync(full, "utf8");
        const methods = HTTP_METHODS.filter((m) => new RegExp(`export (const|async function|function) ${m}\\b`).test(source));
        const apiPath = "/" + path.relative(root, dir).split(path.sep).map((segment) => segment.replace(/^\[(.+)\]$/, "{$1}")).join("/");
        routes.set(apiPath, methods);
      }
    }
  };
  walk(root);
  return routes;
}

/** Collect every `$ref` in the document. */
function collectRefs(node: unknown, refs: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) node.forEach((n) => collectRefs(n, refs));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") refs.add(value);
      else collectRefs(value, refs);
    }
  }
  return refs;
}

describe("OpenAPI contract", () => {
  it("documents every implemented route and method under app/api/v1", () => {
    const routes = implementedRoutes();
    expect(routes.size).toBeGreaterThan(30);
    for (const [apiPath, methods] of routes) {
      expect(document.paths[apiPath], `path ${apiPath} must be documented`).toBeDefined();
      expect(methods.length, `${apiPath} exports no HTTP method`).toBeGreaterThan(0);
      for (const method of methods) expect(document.paths[apiPath][method.toLowerCase()], `${method} ${apiPath} must be documented`).toBeDefined();
    }
    for (const [apiPath, item] of Object.entries<Record<string, unknown>>(document.paths)) {
      const implemented = routes.get(apiPath);
      expect(implemented, `documented path ${apiPath} has no route.ts`).toBeDefined();
      for (const method of Object.keys(item)) expect(implemented, `${method.toUpperCase()} ${apiPath} is documented but not exported`).toContain(method.toUpperCase());
    }
  });

  it("requires the API key on every organization operation and only there", () => {
    const publicPaths = new Set(["/public/events", "/openapi.json", "/docs"]);
    for (const [apiPath, item] of Object.entries<Record<string, any>>(document.paths)) {
      for (const [method, operation] of Object.entries<any>(item)) {
        const expected = publicPaths.has(apiPath) ? [] : [{ bearerAuth: [] }];
        expect(operation.security, `${method.toUpperCase()} ${apiPath} security`).toEqual(expected);
      }
    }
    expect(document.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
  });

  it("gives every operation a unique operationId, a tag, and resolvable references", () => {
    const ids = new Set<string>();
    const tags = new Set(document.tags.map((t: { name: string }) => t.name));
    for (const item of Object.values<Record<string, any>>(document.paths)) {
      for (const operation of Object.values<any>(item)) {
        expect(ids.has(operation.operationId), `duplicate operationId ${operation.operationId}`).toBe(false);
        ids.add(operation.operationId);
        for (const tag of operation.tags) expect(tags.has(tag), `tag ${tag} must be declared`).toBe(true);
      }
    }
    for (const ref of collectRefs(document)) {
      const [, , section, name] = ref.split("/");
      expect(document.components[section!]?.[name!], `${ref} must resolve`).toBeDefined();
    }
  });

  it("honours Idempotency-Key on every write and documents the replay header", () => {
    for (const [apiPath, item] of Object.entries<Record<string, any>>(document.paths)) {
      for (const method of ["post", "put", "patch"]) {
        const operation = item[method];
        if (!operation) continue;
        expect(operation.parameters?.some((p: { name: string }) => p.name === "Idempotency-Key"), `${method.toUpperCase()} ${apiPath} must accept Idempotency-Key`).toBe(true);
        const success = Object.entries<any>(operation.responses).find(([status]) => status.startsWith("2"))!;
        expect(success[1].headers["Idempotency-Replayed"], `${method.toUpperCase()} ${apiPath} ${success[0]} must document Idempotency-Replayed`).toBeDefined();
        expect(operation.responses["409"], `${method.toUpperCase()} ${apiPath} must document 409`).toBeDefined();
      }
    }
  });

  it("documents the nested event input required by runtime validation", () => {
    const schemas = document.components.schemas;
    expect(schemas.SocialLink.required).toEqual(["platform", "url"]);
    expect(schemas.Host.required).toEqual(["name"]);
    expect(schemas.Sponsor.required).toEqual(["name"]);
    expect(schemas.CreateEventInput.properties.socialLinks.items.$ref).toBe("#/components/schemas/SocialLink");
    expect(schemas.CreateEventInput.properties.hosts.items.$ref).toBe("#/components/schemas/Host");
    expect(schemas.CreateEventInput.properties.sponsors.items.$ref).toBe("#/components/schemas/Sponsor");
    expect(schemas.CreateEventInput.properties.onlineUrl.oneOf).toContainEqual({
      type: "string", format: "uri", pattern: "^[hH][tT][tT][pP][sS]?://", maxLength: 500,
    });
    expect(schemas.CreateEventInput.properties.onlineUrl.oneOf).toContainEqual({ type: "string", const: "" });
    expect(schemas.UpdateEventInput.required).toBeUndefined();
  });

  it("never documents a stored secret on read shapes, and returns webhook secrets once", () => {
    const schemas = document.components.schemas;
    expect(schemas.Webhook.properties).not.toHaveProperty("secret");
    expect(schemas.WebhookWithSecret.allOf[1].required).toEqual(["secret"]);
    expect(schemas.Organization.properties).not.toHaveProperty("stripeAccountId");
    expect(schemas.WaitlistEntry.properties).not.toHaveProperty("token");
    expect(schemas.Attendee.properties.ticket.oneOf[0].$ref).toBe("#/components/schemas/AttendeeTicket");
    expect(schemas.Invite.properties.url.format).toBe("uri");
  });

  it("documents the organization slug used in canonical event URLs", () => {
    const publicEvent = document.components.schemas.PublicEvent;
    expect(publicEvent.required).toContain("orgSlug");
    expect(publicEvent.properties.orgSlug).toEqual({ type: "string" });
  });

  it("documents the discovery filters and the price summary the cards rely on", () => {
    const parameters = document.paths["/public/events"].get.parameters.map((p: { name: string }) => p.name);
    expect(parameters).toEqual(["query", "city", "tag", "from", "to", "price", "format", "lat", "lng", "radiusKm", "limit", "offset"]);
    const publicEvent = document.components.schemas.PublicEvent;
    expect(publicEvent.required).toContain("isFree");
    expect(publicEvent.properties.minPriceMinor.type).toEqual(["integer", "null"]);
    expect(publicEvent.properties.distanceKm.type).toEqual(["number", "null"]);
  });

  it("documents bounded JSON body failures", () => {
    const responses = document.paths["/events"].post.responses;
    expect(responses["400"]).toBeDefined();
    expect(responses["413"]).toBeDefined();
    expect(responses["415"]).toBeDefined();
  });

  it("documents rate-limit headers on quota-consuming responses", () => {
    const responses = document.paths["/events"].post.responses;
    expect(responses["201"].headers["X-RateLimit-Remaining"]).toBeDefined();
    expect(document.components.responses.ValidationError.headers["X-RateLimit-Remaining"]).toBeDefined();
    expect(document.components.responses.NotFound.headers["X-RateLimit-Remaining"]).toBeDefined();
  });

  it("links to the interactive Scalar documentation", () => {
    expect(document.externalDocs).toEqual({
      description: "Interactive API documentation",
      url: "/api/v1/docs",
    });
  });
});
