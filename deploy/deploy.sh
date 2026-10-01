#!/usr/bin/env sh
# Ship the checked-out commit on the one-VM stack: pull, build with the commit baked in (Datadog
# version and source links), restart the app, drop the previous image. Run from the repository root.
# Host prerequisites: sh, git, Docker Compose with --wait/--wait-timeout, and curl
# with --retry-connrefused and its system CA trust store. JSON validation uses the MCP image's Node.
set -eu
cd "$(dirname "$0")/.."
git pull --ff-only
sha=$(git rev-parse HEAD)
GIT_SHA="$sha" APP_VERSION="$(git rev-parse --short HEAD)" \
  docker compose --env-file .env -f deploy/docker-compose.prod.yml up -d --build --wait --wait-timeout 300 app mcp
# Caddy does not automatically reload a changed bind-mounted Caddyfile. Recreate only the proxy.
docker compose --env-file .env -f deploy/docker-compose.prod.yml up -d --no-deps --force-recreate caddy
# No healthcheck is configured for Caddy today; require running, and healthy if one is added.
caddy_id=$(docker compose --env-file .env -f deploy/docker-compose.prod.yml ps -q caddy)
[ -n "$caddy_id" ] || { echo "Caddy is not running" >&2; exit 1; }
caddy_state=$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$caddy_id")
case "$caddy_state" in
  'running none'|'running healthy') ;;
  *) echo "Caddy is not ready" >&2; exit 1 ;;
esac
# Use Node already present in the production MCP image, not a host JSON parser.
# Read only the public origin, never the host .env or the full container environment.
public_url=$(docker compose --env-file .env -f deploy/docker-compose.prod.yml exec -T mcp node -e '
  const url = new URL(process.env.EVNELO_URL);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    console.error("MCP public URL must be an HTTPS origin"); process.exit(1);
  }
  console.log(url.origin + "/mcp");
')
# A real TLS-verified public request gates success. All attempts have bounded timeouts;
# curl retries transient HTTP failures / refused connections while Caddy obtains its certificate.
response=$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
  --retry 5 --retry-delay 2 --retry-max-time 60 --retry-connrefused \
  --header 'Content-Type: application/json' --header 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"evnelo-deploy","version":"1"}}}' \
  "$public_url")
printf '%s' "$response" | docker compose --env-file .env -f deploy/docker-compose.prod.yml exec -T mcp node -e '
  try {
    const message = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
    const result = message.result;
    if (message.jsonrpc !== "2.0" || message.id !== 1 || "error" in message ||
        !result || result.protocolVersion !== "2025-03-26" ||
        !result.capabilities || typeof result.capabilities !== "object" || Array.isArray(result.capabilities) ||
        !result.serverInfo || typeof result.serverInfo.name !== "string" || !result.serverInfo.name ||
        typeof result.serverInfo.version !== "string" || !result.serverInfo.version) throw new Error();
  } catch {
    console.error("Public MCP initialize did not return a valid JSON-RPC result"); process.exit(1);
  }
'
docker image prune -f >/dev/null
echo "deployed $sha"
