#!/usr/bin/env node
import { createPublicHttpServer } from "./http.js";

const port = Number(process.env.MCP_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("MCP_PORT must be between 1 and 65535.");
const list = (value: string | undefined) => value?.split(",").map(v => v.trim()).filter(Boolean);
const server = createPublicHttpServer({
  baseUrl: process.env.EVNELO_URL ?? "http://localhost:3000",
  allowedHosts: list(process.env.MCP_ALLOWED_HOSTS),
  allowedOrigins: list(process.env.MCP_ALLOWED_ORIGINS),
});
server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`${JSON.stringify({ scope: "mcp.public.ready", endpoint: `http://127.0.0.1:${port}/mcp` })}\n`);
});
for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => {
  server.closeAllConnections();
  server.close(() => { process.exitCode = 0; });
});
