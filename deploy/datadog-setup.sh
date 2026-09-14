#!/usr/bin/env bash
# Infrastructure monitoring for the one-VM deployment: the Datadog agent on the host (system,
# disk, Docker), one Synthetics uptime check on /api/health, and three monitors. Run it on the
# server as a user that can sudo, with the keys exported:
#
#   DD_API_KEY=… DD_APP_KEY=… ./deploy/datadog-setup.sh
#
# Optional: DD_SITE (default datadoghq.com), DD_HOSTNAME (default evnelo), DD_NOTIFY (default
# @giordano@inevent.com), APP_URL (default https://evnelo.com), DD_LOGS=true to also ship
# container logs to Datadog (app logs already go to PostHog Logs).
# Idempotent: re-running upgrades the agent and skips monitors and tests that already exist.
set -euo pipefail

: "${DD_API_KEY:?DD_API_KEY is required (Datadog → Organization settings → API keys)}"
: "${DD_APP_KEY:?DD_APP_KEY is required (Datadog → Organization settings → Application keys)}"
DD_SITE="${DD_SITE:-datadoghq.com}"
DD_HOSTNAME="${DD_HOSTNAME:-evnelo}"
DD_NOTIFY="${DD_NOTIFY:-@giordano@inevent.com}"
APP_URL="${APP_URL:-https://evnelo.com}"
DD_LOGS="${DD_LOGS:-false}"
API="https://api.${DD_SITE}/api/v1"

api() { # method path [json]
  curl -sS -X "$1" "${API}$2" -H "DD-API-KEY: ${DD_API_KEY}" -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" -H "Content-Type: application/json" ${3:+-d "$3"}
}

echo "== agent"
if ! command -v datadog-agent >/dev/null 2>&1 && [ ! -x /opt/datadog-agent/bin/agent/agent ]; then
  DD_API_KEY="$DD_API_KEY" DD_SITE="$DD_SITE" DD_HOSTNAME="$DD_HOSTNAME" DD_ENV=production DD_TAGS="service:evnelo" \
    bash -c "$(curl -L https://install.datadoghq.com/scripts/install_script_agent7.sh)"
fi
# Docker metrics need the socket; container logs are opt-in
sudo usermod -aG docker dd-agent
sudo tee /etc/datadog-agent/conf.d/docker.d/conf.yaml >/dev/null <<YAML
init_config:
instances:
  - url: "unix://var/run/docker.sock"
    collect_container_size: true
YAML
if [ "$DD_LOGS" = "true" ]; then
  sudo sed -i 's/^# *logs_enabled:.*/logs_enabled: true/' /etc/datadog-agent/datadog.yaml
  grep -q '^logs_config:' /etc/datadog-agent/datadog.yaml || printf 'logs_config:\n  container_collect_all: true\n' | sudo tee -a /etc/datadog-agent/datadog.yaml >/dev/null
fi
sudo systemctl restart datadog-agent
sudo systemctl is-active datadog-agent

echo "== synthetics: uptime check on ${APP_URL}/api/health"
if ! api GET "/synthetics/tests" | grep -q '"name":"Evnelo is up"'; then
  api POST "/synthetics/tests/api" "$(cat <<JSON
{
  "name": "Evnelo is up",
  "type": "api",
  "subtype": "http",
  "tags": ["service:evnelo", "env:production"],
  "locations": ["aws:us-east-1", "aws:eu-west-1", "aws:sa-east-1"],
  "message": "evnelo.com is not answering its health check. ${DD_NOTIFY}",
  "config": {
    "request": { "method": "GET", "url": "${APP_URL}/api/health", "timeout": 30 },
    "assertions": [
      { "type": "statusCode", "operator": "is", "target": 200 },
      { "type": "responseTime", "operator": "lessThan", "target": 3000 },
      { "type": "body", "operator": "contains", "target": "ok" }
    ]
  },
  "options": {
    "tick_every": 300,
    "min_failure_duration": 300,
    "min_location_failed": 2,
    "retry": { "count": 1, "interval": 30 },
    "monitor_options": { "renotify_interval": 60 },
    "monitor_priority": 1
  }
}
JSON
)"; echo
else echo "exists"; fi

echo "== monitors"
create_monitor() { # name json
  if api GET "/monitor/search?query=title:%22$(printf '%s' "$1" | sed 's/ /%20/g')%22" | grep -q "\"name\":\"$1\""; then echo "exists: $1"; return; fi
  api POST "/monitor" "$2"; echo
}
create_monitor "Evnelo host stopped reporting" "$(cat <<JSON
{
  "name": "Evnelo host stopped reporting",
  "type": "service check",
  "query": "\"datadog.agent.up\".over(\"host:${DD_HOSTNAME}\").by(\"host\").last(2).count_by_status()",
  "message": "The Datadog agent on ${DD_HOSTNAME} has not reported for 10 minutes: the VM may be down. ${DD_NOTIFY}",
  "tags": ["service:evnelo", "env:production"],
  "priority": 1,
  "options": { "thresholds": { "critical": 1 }, "notify_no_data": true, "no_data_timeframe": 10, "renotify_interval": 60 }
}
JSON
)"
create_monitor "Evnelo container not running" "$(cat <<JSON
{
  "name": "Evnelo container not running",
  "type": "query alert",
  "query": "min(last_5m):sum:docker.containers.running{host:${DD_HOSTNAME}} < 3",
  "message": "Fewer than the three containers (caddy, app, db) are running on ${DD_HOSTNAME}. Check \`docker compose ps\` and \`docker compose logs app\`. ${DD_NOTIFY}",
  "tags": ["service:evnelo", "env:production"],
  "priority": 1,
  "options": { "thresholds": { "critical": 3 }, "notify_no_data": true, "no_data_timeframe": 15, "renotify_interval": 60 }
}
JSON
)"
create_monitor "Evnelo disk above 80%" "$(cat <<JSON
{
  "name": "Evnelo disk above 80%",
  "type": "query alert",
  "query": "avg(last_15m):avg:system.disk.in_use{host:${DD_HOSTNAME},device:/dev/root} > 0.8",
  "message": "The root disk on ${DD_HOSTNAME} is {{value}} full. Old Docker images (\`docker system prune\`) and MySQL backups are the usual culprits. ${DD_NOTIFY}",
  "tags": ["service:evnelo", "env:production"],
  "priority": 2,
  "options": { "thresholds": { "critical": 0.8, "warning": 0.7 }, "notify_no_data": false, "renotify_interval": 1440 }
}
JSON
)"
echo "== done"
