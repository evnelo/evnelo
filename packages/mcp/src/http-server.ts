#!/usr/bin/env node
import { createPublicHttpServer } from "./http.js";
import { readHttpConfig } from "./http-config.js";

const options = readHttpConfig(process.env);
const server = createPublicHttpServer(options);
server.listen(options.port, options.bind, () => {
  process.stdout.write(`${JSON.stringify({ scope: "mcp.public.ready", endpoint: `http://${options.bind.includes(":") ? `[${options.bind}]` : options.bind}:${options.port}/mcp` })}\n`);
});
for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => {
  server.closeAllConnections();
  server.close(() => { process.exitCode = 0; });
});
