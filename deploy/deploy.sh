#!/usr/bin/env bash
# Ship the `production` branch on the one-VM stack. Run from anywhere; it works on the checkout it
# lives in. Steps: fetch and hard-reset to origin/production (the branch CI fast-forwards only after
# every check passed on master), keep the running app and MCP images as :previous, build both with
# the commit baked in (Datadog version and source links), restart them and wait for their health
# checks, then recreate Caddy (it does not reload a changed bind-mounted Caddyfile) and require a
# real TLS-verified public MCP initialize. If app or MCP never turn healthy the previous images go
# back and the script exits 1; the commit is then not retried until production moves again.
#
#   ./deploy/deploy.sh            # deploy whatever origin/production points at
#   ./deploy/deploy.sh --local    # skip the fetch: deploy the commit checked out right now
#
# deploy/auto-deploy.sh calls this from cron; a lock keeps the two from overlapping. Host needs bash,
# git, flock, Docker Compose with --wait/--wait-timeout, and curl with --retry-connrefused and a
# system CA store. JSON validation uses the Node already in the MCP image.
set -euo pipefail
cd "$(dirname "$0")/.."

lock="${EVNELO_DEPLOY_LOCK:-/tmp/evnelo-deploy.lock}"
exec 9>"$lock"
flock -w 600 9 || { echo "another deploy is still running"; exit 1; }

compose() { docker compose --env-file .env -f deploy/docker-compose.prod.yml "$@"; }
state="${EVNELO_DEPLOY_STATE:-$HOME/.evnelo-deployed}"
images=(evnelo-app evnelo-mcp) # compose project `evnelo`, services app and mcp

if [ "${1:-}" != "--local" ]; then
  git fetch --quiet origin production
  # a hard reset, so a hotfix copied onto the box never blocks the next release (it is superseded by it)
  git checkout --quiet -B production
  git reset --quiet --hard origin/production
fi
sha=$(git rev-parse HEAD)
short=$(git rev-parse --short HEAD)
fail() { echo "$1" >&2; echo "$sha" > "$state.failed"; exit 1; }

# keep the running images for a rollback; `compose build` retags :latest
for image in "${images[@]}"; do
  if docker image inspect "$image:latest" >/dev/null 2>&1; then docker tag "$image:latest" "$image:previous"; fi
done

echo "building $short"
GIT_SHA="$sha" APP_VERSION="$short" compose build --quiet app mcp || fail "build failed on $short; nothing was restarted"

if ! GIT_SHA="$sha" APP_VERSION="$short" compose up -d --no-build --wait --wait-timeout 300 app mcp; then
  echo "app or mcp did not become healthy on $short; last log lines:" >&2
  compose logs --tail 40 app mcp >&2 || true
  rolled=()
  for image in "${images[@]}"; do
    if docker image inspect "$image:previous" >/dev/null 2>&1; then docker tag "$image:previous" "$image:latest"; rolled+=("${image#evnelo-}"); fi
  done
  if [ "${#rolled[@]}" -gt 0 ]; then
    echo "rolling back ${rolled[*]} to the previous image" >&2
    compose up -d --no-build "${rolled[@]}" || true
  fi
  # Caddy keeps its old configuration: it is only recreated after a healthy rollout
  fail "deploy of $short failed"
fi

compose up -d --no-deps --force-recreate caddy
caddy_id=$(compose ps -q caddy)
[ -n "$caddy_id" ] || fail "Caddy is not running"
case "$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$caddy_id")" in
  'running none'|'running healthy') ;;
  *) fail "Caddy is not ready" ;;
esac

# Read only the public origin from the MCP container, never the host .env.
public_url=$(compose exec -T mcp node -e '
  const url = new URL(process.env.EVNELO_URL);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    console.error("MCP public URL must be an HTTPS origin"); process.exit(1);
  }
  console.log(url.origin + "/mcp");
') || fail "could not read the public MCP URL"
# curl retries transient failures / refused connections while Caddy obtains its certificate
response=$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
  --retry 5 --retry-delay 2 --retry-max-time 60 --retry-connrefused \
  --header 'Content-Type: application/json' --header 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"evnelo-deploy","version":"1"}}}' \
  "$public_url") || fail "public MCP initialize request failed"
printf '%s' "$response" | compose exec -T mcp node -e '
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
' || fail "public MCP initialize returned an invalid result"

echo "$sha" > "$state"
rm -f "$state.failed"
docker image prune -f >/dev/null
echo "deployed $short"
