import { describe, expect, it } from "vitest";
import { openApiDocument } from "./openapi";

const document = openApiDocument as Record<string, any>;

describe("OpenAPI contract", () => {
  it("documents the nested event input required by runtime validation", () => {
    const schemas = document.components.schemas;
    expect(schemas.SocialLink.required).toEqual(["platform", "url"]);
    expect(schemas.Host.required).toEqual(["name"]);
    expect(schemas.Sponsor.required).toEqual(["name"]);
    expect(schemas.CreateEventInput.properties.socialLinks.items.$ref).toBe("#/components/schemas/SocialLink");
    expect(schemas.CreateEventInput.properties.hosts.items.$ref).toBe("#/components/schemas/Host");
    expect(schemas.CreateEventInput.properties.sponsors.items.$ref).toBe("#/components/schemas/Sponsor");
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
});
