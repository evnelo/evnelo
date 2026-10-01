import { request } from "node:http";
import { readHttpConfig } from "./http-config.js";

const config = readHttpConfig(process.env);
const host = config.allowedHosts?.[0] ?? `127.0.0.1:${config.port}`;
// Node 22 fetch strips a custom Host header. Use HTTP directly so the probe exercises the same
// approved production Host policy as Caddy, without opening a loopback bypass.
await new Promise<void>((resolve, reject) => {
  const req = request({ hostname: "127.0.0.1", port: config.port, path: "/mcp", method: "POST",
    headers: { Host: host, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    signal: AbortSignal.timeout(3000),
  }, res => {
    let body = "";
    res.setEncoding("utf8"); res.on("data", chunk => { body += chunk; });
    res.on("error", reject);
    res.on("end", () => {
      try {
        if (res.statusCode !== 200 || JSON.parse(body).result?.serverInfo?.name !== "evnelo-public") throw new Error("MCP initialization healthcheck failed.");
        resolve();
      } catch (error) { reject(error); }
    });
  });
  req.on("error", reject);
  req.end(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "evnelo-healthcheck", version: "1" } } }));
});
