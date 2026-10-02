import { describe, it, expect } from "vitest";

describe("delegated OAuth configuration", () => {
  it("accepts exact loopback authority and rejects unsafe authority", async () => {
    const module = await import("../services/oauth").catch(() => null);
    expect(module?.DelegatedOAuth).toBeTypeOf("function");
    const OAuth = module!.DelegatedOAuth;
    expect(() => new OAuth({ issuer: "http://localhost:3901", resource: "http://localhost:3901/mcp" })).not.toThrow();
    for (const issuer of ["http://example.com", "https://a.example/#x", "https://u:p@a.example", "https://a.example/?x=1"]) {
      expect(() => new OAuth({ issuer, resource: `${issuer}/mcp` })).toThrow();
    }
    expect(() => new OAuth({ issuer: "https://a.example", resource: "https://other.example/mcp" })).toThrow();
  });
  it("bounds configured lifetimes and accepts shorter deterministic test lifetimes", async () => {
    const { DelegatedOAuth } = await import("../services/oauth");
    for (const lifetimes of [{ codeTtlMs: 0 }, { codeTtlMs: 120001 }, { accessTtlMs: Infinity }, { refreshTtlMs: 30 * 86400000 + 1 }]) {
      expect(() => new DelegatedOAuth({ issuer: "http://localhost:3901", resource: "http://localhost:3901/mcp", ...lifetimes })).toThrow();
    }
    expect(() => new DelegatedOAuth({ issuer: "http://localhost:3901", resource: "http://localhost:3901/mcp", codeTtlMs: 1000, accessTtlMs: 2000, refreshTtlMs: 3000 })).not.toThrow();
  });
  it("captures an immutable authority configuration", async () => {
    const { DelegatedOAuth } = await import("../services/oauth");
    const config = { issuer: "http://localhost:3901", resource: "http://localhost:3901/mcp" };
    const engine = new DelegatedOAuth(config);
    config.resource = "http://localhost:3901/other";
    expect(engine.config.resource).toBe("http://localhost:3901/mcp");
    expect(Object.isFrozen(engine.config)).toBe(true);
  });
});
