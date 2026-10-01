import { expect, test } from "vitest";
import { createPublicServer } from "./public-server.js";

test("HTTP config keeps loopback defaults and validates production bind and exact policies", async () => {
  const mod = await import("./http-config.js").catch(() => ({})) as Record<string, any>;
  expect(mod.readHttpConfig).toBeTypeOf("function");
  expect(mod.readHttpConfig({})).toMatchObject({ bind: "127.0.0.1", port: 3001, baseUrl: "http://localhost:3000" });
  expect(mod.readHttpConfig({ MCP_BIND: "0.0.0.0", EVNELO_URL: "https://tickets.example.test", EVNELO_API_URL: "http://app:3000" })).toMatchObject({ bind: "0.0.0.0", apiUrl: "http://app:3000", allowedHosts: ["tickets.example.test"] });
  for (const env of [{ MCP_BIND: "evil.example" }, { MCP_BIND: "0.0.0.0" }, { MCP_PORT: "0" }, { MCP_PORT: "nan" }, { MCP_ALLOWED_HOSTS: "*" }, { MCP_ALLOWED_HOSTS: "https://tickets.example.test" }, { MCP_ALLOWED_ORIGINS: "*" }, { MCP_ALLOWED_ORIGINS: "https://example.test/path" }, { MCP_ALLOWED_ORIGINS: "null" }]) {
    expect(() => mod.readHttpConfig(env)).toThrow();
  }
  expect(mod.readHttpConfig({ MCP_ALLOWED_ORIGINS: "https://chatgpt.com", MCP_ALLOWED_HOSTS: "tickets.example.test" }).allowedOrigins).toEqual(["https://chatgpt.com"]);
});

test("canonical and API origins validate independently before requests", async () => {
  await expect(createPublicServer({ baseUrl: "https://tickets.example.test", apiUrl: "http://app:3000" })).resolves.toBeDefined();
  for (const apiUrl of ["file:///etc/passwd", "http://user:pass@app:3000", "http://app:3000/private", "http://app:3000/a/../", "http://app:3000?", "http://app:3000/#", "http://169.254.169.254", "http://[fe80::1]", "http://metadata.google.internal"]) {
    await expect(createPublicServer({ baseUrl: "https://tickets.example.test", apiUrl })).rejects.toThrow();
  }
  await expect(createPublicServer({ baseUrl: "http://app:3000", apiUrl: "https://tickets.example.test" })).rejects.toThrow();
});
