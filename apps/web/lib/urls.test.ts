import { describe, expect, it } from "vitest";
import { organizationPath, organizationSlugPreview, publicEventPath, serializeJsonLd } from "./urls";

describe("public URLs", () => {
  it("places the organization slug before the event slug", () => {
    expect(publicEventPath("adobe", "adobe-summit")).toBe("/adobe/adobe-summit");
  });

  it("keeps organization profiles under their existing namespace", () => {
    expect(organizationPath("adobe")).toBe("/o/adobe");
  });

  it("uses the typed organization slug in the public URL preview", () => {
    expect(organizationSlugPreview("adobe", "suggested-org")).toBe("/o/adobe");
    expect(organizationSlugPreview("", "suggested-org")).toBe("/o/suggested-org");
  });

  it("serializes JSON-LD without allowing script breakout", () => {
    const serialized = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script>");
  });
});
