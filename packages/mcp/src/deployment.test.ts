import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
const read = (path: string) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("production packages an isolated public MCP service behind exact Caddy routing and recreates the proxy on deploy", async () => {
  const compose = await read("deploy/docker-compose.prod.yml");
  expect(compose).toContain('"ping", "-h", "127.0.0.1"');
  expect(compose).toContain("  mcp:");
  const mcp = compose.split("  mcp:\n")[1]!.split("\n  db:")[0]!;
  expect(mcp).toContain("dockerfile: packages/mcp/Dockerfile");
  expect(mcp).toContain("EVNELO_URL: ${APP_URL:?set APP_URL to the public HTTPS origin}");
  expect(mcp).toContain("EVNELO_API_URL: http://app:3000");
  expect(mcp).toContain('MCP_BIND: "0.0.0.0"');
  expect(mcp).not.toMatch(/env_file|ports:|API_KEY|DATABASE_URL|AUTH_SECRET/);
  const caddy = await read("deploy/Caddyfile");
  expect(caddy).toContain("handle /mcp {");
  expect(caddy).toContain("reverse_proxy mcp:3001 {");
  expect(caddy).toContain("flush_interval -1");
  expect(caddy).toContain("header_up -Authorization");
  expect(caddy).toContain("reverse_proxy app:3000");
  expect(caddy).toContain("www.{$SITE_ADDRESS}");
  const deploy = await read("deploy/deploy.sh");
  // images are built first (a failed build restarts nothing), then started with a bounded health wait
  expect(deploy).toContain("build --quiet app mcp");
  expect(deploy).toContain("up -d --no-build --wait --wait-timeout 300 app mcp");
  expect(deploy).toContain("up -d --no-deps --force-recreate caddy");
  const image = await read("packages/mcp/Dockerfile");
  expect(image).toContain("USER node");
  expect(image).toContain('CMD ["node", "http-server.mjs"]');
  expect(await read(".github/workflows/ci.yml")).toContain("file: packages/mcp/Dockerfile");
});
