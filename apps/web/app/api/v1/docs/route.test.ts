import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { SCALAR_CDN_URL, SCALAR_INTEGRITY } from "./scalar";

describe("Scalar API documentation", () => {
  it("pins and integrity-checks the browser bundle under a strict CSP", async () => {
    const response = await GET();
    const html = await response.text();
    const nonce = html.match(/<meta property="csp-nonce" content="([^"]+)"/)?.[1];

    expect(SCALAR_CDN_URL).toMatch(/@scalar\/api-reference@\d+\.\d+\.\d+$/);
    expect(SCALAR_INTEGRITY).toMatch(/^sha384-[A-Za-z0-9+/]+=*$/);
    expect(html).toContain(`src="${SCALAR_CDN_URL}"`);
    expect(html).toContain(`integrity="${SCALAR_INTEGRITY}"`);
    expect(html).toContain('crossorigin="anonymous"');
    expect(html).not.toContain("@scalar/api-reference/esm.js");
    expect(nonce).toBeTruthy();
    expect(response.headers.get("content-security-policy")).toContain(`script-src 'nonce-${nonce}' 'strict-dynamic'`);
  });
});
