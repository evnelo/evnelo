import { createServer, type IncomingMessage } from "node:http";
import { validatePolicies } from "./http-config.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createPublicServer, validatePublicOrigin, validateApiOrigin } from "./public-server.js";

type Options = { baseUrl: string; apiUrl?: string; allowedHosts?: string[]; allowedOrigins?: string[]; rateLimit?: { max: number; windowMs: number } };
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
  const apiUrl = options.apiUrl === undefined ? undefined : validateApiOrigin(options.apiUrl);
  validatePolicies(options.allowedHosts, options.allowedOrigins);
  const rate = options.rateLimit ?? { max: 600, windowMs: 60_000 };
  let windowStart = Date.now();
  let requests = 0;
  let active = 0;
  // Shared by every fresh POST server; transport close is not discovery settlement.
  let work = 0;
  const acquireWork = () => {
    if (work >= 32) throw new Error("Public discovery busy.");
    work++;
    return () => { work--; };
  };
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
    const now = Date.now();
    if (now - windowStart >= rate.windowMs) { windowStart = now; requests = 0; }
    if (++requests > rate.max) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((windowStart + rate.windowMs - now) / 1000)));
      return deny(429);
    }
    if (active >= 32 || work >= 32) return deny(503);
    active++;
    const disconnect = new AbortController();
    req.once("aborted", () => disconnect.abort());
    let server: Awaited<ReturnType<typeof createPublicServer>> | undefined;
    res.once("close", () => { active--; disconnect.abort(); void server?.close(); });
    try {
      const body = await readBody(req);
      if (Array.isArray(body)) return deny(400);
      disconnect.signal.throwIfAborted();
      server = await createPublicServer({ baseUrl, apiUrl, signal: disconnect.signal, acquireWork });
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
