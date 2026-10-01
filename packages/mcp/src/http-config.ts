import { isIP } from "node:net";
import { validateApiOrigin, validatePublicOrigin } from "./public-server.js";

export function validatePolicies(hosts?: string[], origins?: string[]) {
  for (const host of hosts ?? []) {
    const url = new URL(`http://${host}`);
    if (url.host !== host || url.username || url.password || url.pathname !== "/" || url.search || url.hash || /[\s/*?#@]/.test(host)) throw new Error("MCP_ALLOWED_HOSTS must contain exact Host values, not URLs or wildcards.");
  }
  for (const origin of origins ?? []) {
    if (validatePublicOrigin(origin) !== origin) throw new Error("MCP_ALLOWED_ORIGINS must contain exact origins.");
  }
}

/** Only operator environment config; never derived from incoming headers. */
export function readHttpConfig(env: NodeJS.ProcessEnv) {
  const port = Number(env.MCP_PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("MCP_PORT must be between 1 and 65535.");
  const bind = env.MCP_BIND ?? "127.0.0.1";
  if (!isIP(bind)) throw new Error("MCP_BIND must be a literal IP address.");
  const baseUrl = validatePublicOrigin(env.EVNELO_URL ?? "http://localhost:3000");
  const apiUrl = env.EVNELO_API_URL === undefined ? undefined : validateApiOrigin(env.EVNELO_API_URL);
  const list = (value: string | undefined) => value?.split(",").map(v => v.trim()).filter(Boolean);
  const exposed = !["127.0.0.1", "::1"].includes(bind);
  if (exposed && !baseUrl.startsWith("https://")) throw new Error("Non-loopback MCP_BIND requires an HTTPS public EVNELO_URL behind a reverse proxy.");
  const allowedHosts = list(env.MCP_ALLOWED_HOSTS) ?? (exposed ? [new URL(baseUrl).host] : undefined);
  const allowedOrigins = list(env.MCP_ALLOWED_ORIGINS);
  validatePolicies(allowedHosts, allowedOrigins);
  return { bind, port, baseUrl, apiUrl, allowedHosts, allowedOrigins };
}
