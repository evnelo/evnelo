import { describe, expect, it } from "vitest";
import { slugify, slugSuffix } from "../slug";
import { normalizeWebsiteUrl } from "../url";
import { can } from "../permissions";
import { organizationInput } from "../services/orgs";

describe("slugify", () => {
  it("folds accents and punctuation", () => {
    expect(slugify("Design Systems Meetup, September edition")).toBe("design-systems-meetup-september-edition");
    expect(slugify("  São Paulo — Café & Código!  ")).toBe("sao-paulo-cafe-codigo");
  });
  it("never returns an empty slug and respects the max length", () => {
    expect(slugify("!!!")).toBe("event");
    expect(slugify("a".repeat(100)).length).toBe(80);
    expect(slugify("abc-".repeat(30), 10)).toBe("abc-abc-ab");
  });
  it("makes short suffixes", () => {
    expect(slugSuffix()).toMatch(/^[a-z0-9]{4}$/);
  });
});

describe("organization slugs", () => {
  it("rejects top-level routes reserved by the application", () => {
    for (const slug of ["api", "dashboard", "dev", "discover", "e", "invite", "login", "o", "onboarding", "t", "unsubscribe"]) {
      expect(organizationInput.safeParse({ name: "Example", slug }).success, slug).toBe(false);
    }
    expect(organizationInput.safeParse({ name: "Adobe", slug: "adobe" }).success).toBe(true);
  });
});

describe("organization websites", () => {
  it("prefixes domains with https and preserves explicit protocols", () => {
    expect(normalizeWebsiteUrl("adobe.com")).toBe("https://adobe.com");
    expect(normalizeWebsiteUrl("https://adobe.com/events")).toBe("https://adobe.com/events");
    expect(normalizeWebsiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeWebsiteUrl("  ")).toBe("");
  });

  it("accepts a bare domain in organization input", () => {
    const parsed = organizationInput.parse({ name: "Adobe", slug: "adobe", website: "adobe.com" });
    expect(parsed.website).toBe("https://adobe.com");
  });

  it("rejects unsupported and protocol-relative website URLs", () => {
    for (const website of ["ftp://evil.example", "javascript:alert(1)", "//evil.example"]) {
      expect(organizationInput.safeParse({ name: "Adobe", slug: "adobe", website }).success, website).toBe(false);
    }
  });
});

describe("permissions", () => {
  it("scopes roles", () => {
    expect(can("owner", "manage_members")).toBe(true);
    expect(can("member", "edit_events")).toBe(true);
    expect(can("member", "refund")).toBe(false);
    expect(can("checkin", "check_in")).toBe(true);
    expect(can("checkin", "view_events")).toBe(false);
    expect(can(null, "view_events")).toBe(false);
  });
});
