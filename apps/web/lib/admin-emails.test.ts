import { describe, expect, it } from "vitest";
import { isPlatformAdmin, parseAdminEmails } from "./admin-emails";

describe("platform admin list", () => {
  it("parses commas, spaces and case", () => {
    expect([...parseAdminEmails(" Ops@Example.com, second@example.com\nthird@example.com,,")]).toEqual(["ops@example.com", "second@example.com", "third@example.com"]);
  });
  it("admits nobody when unset or empty", () => {
    for (const raw of [undefined, null, "", " , "]) expect(isPlatformAdmin("ops@example.com", parseAdminEmails(raw))).toBe(false);
  });
  it("matches whole addresses only", () => {
    const admins = parseAdminEmails("ops@example.com");
    expect(isPlatformAdmin("OPS@example.com", admins)).toBe(true);
    expect(isPlatformAdmin("ops@example.com.evil.test", admins)).toBe(false);
    expect(isPlatformAdmin("x-ops@example.com", admins)).toBe(false);
    expect(isPlatformAdmin(null, admins)).toBe(false);
  });
});
