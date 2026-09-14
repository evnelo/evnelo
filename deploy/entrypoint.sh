#!/bin/sh
# Container entrypoint. When a Datadog agent address is configured, load the APM tracer before
# Next.js so its HTTP, Next and MySQL instrumentation patches the modules as they load; without
# DD_AGENT_HOST the process runs untouched.
set -e
if [ -n "${DD_AGENT_HOST:-}" ]; then
  export NODE_OPTIONS="--require /app/dd/node_modules/dd-trace/init ${NODE_OPTIONS:-}"
fi
exec node apps/web/server.js
