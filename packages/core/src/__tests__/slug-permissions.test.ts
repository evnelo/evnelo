import { describe, expect, it } from "vitest";
import { slugify, slugSuffix } from "../slug";
import { can } from "../permissions";

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
