import { createServer, type IncomingMessage } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createPublicServer, validatePublicOrigin } from "./public-server.js";

type Options = { baseUrl: string; allowedHosts?: string[]; allowedOrigins?: string[] };
const MAX_BODY = 64 * 1024;

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let overflow = false;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) { overflow = true; chunks.length = 0; reject(413); }
      if (!overflow) chunks.push(chunk);
    });
    req.on("end", () => {
      if (overflow) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(400); }
    });
    req.on("error", () => reject(400));
    req.on("aborted", () => reject(400));
  });
}

/** Stateless: a fresh MCP server/transport per POST, no organizer credential or cross-user session. */
export function createPublicHttpServer(options: Options) {
  const baseUrl = validatePublicOrigin(options.baseUrl);
  let active = 0;
  const http = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const deny = (status: number) => { res.writeHead(status); res.end(); req.resume(); };
    const hosts = options.allowedHosts ?? [`localhost:${req.socket.localPort}`, `127.0.0.1:${req.socket.localPort}`];
    if (!req.headers.host || !hosts.includes(req.headers.host)) return deny(403);
    const origin = req.headers.origin;
    if (origin !== undefined && !(options.allowedOrigins ?? []).includes(origin)) return deny(403);
    if (req.url !== "/mcp") return deny(404);
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return deny(405); }
    if (req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !== "application/json") return deny(415);
    if (Number(req.headers["content-length"] ?? 0) > MAX_BODY) return deny(413);
    if (active >= 32) return deny(503);
    active++;
    let server: Awaited<ReturnType<typeof createPublicServer>> | undefined;
    res.once("close", () => { active--; void server?.close(); });
    try {
      const body = await readBody(req);
      server = await createPublicServer({ baseUrl });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error) {
      if (!res.headersSent) deny(typeof error === "number" ? error : 500);
      else res.end();
      await server?.close();
    }
  });
  http.requestTimeout = 15_000;
  http.headersTimeout = 10_000;
  http.timeout = 20_000;
  http.keepAliveTimeout = 5_000;
  return http;
}
