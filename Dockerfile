# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/mcp/package.json packages/mcp/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# NEXT_PUBLIC_* values are inlined at build time: pass the PostHog browser token and host as build args for
# analytics and error reporting; POSTHOG_API_KEY + POSTHOG_PROJECT_ID additionally upload source maps.
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG POSTHOG_API_KEY
ARG POSTHOG_PROJECT_ID
ARG APP_VERSION
# lib/env.ts validates the environment when a page module loads, which happens while `next build`
# collects page data. These placeholders satisfy it; nothing connects to a database during the
# build, and the runner stage does not inherit them.
ENV NEXT_TELEMETRY_DISABLED=1 DATABASE_URL=mysql://build:build@localhost:3306/build AUTH_SECRET=build-time-placeholder-not-used-at-runtime
RUN pnpm build

# Runtime: Next's standalone output (server + traced node_modules) plus static assets and the
# migrations folder. No pnpm, no sources, no dev dependencies.
FROM node:22-alpine AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
# Defaults for a single-container deployment; override in your orchestrator
ENV MIGRATE_ON_START=true JOBS_INLINE=true
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
COPY --from=build --chown=node:node /app/packages/db/drizzle ./packages/db/drizzle
COPY --chown=node:node deploy/entrypoint.sh ./entrypoint.sh
COPY --chown=node:node deploy/dd-init.js ./dd-init.js
# Datadog APM tracer, installed whole and apart from the traced bundle (its plugins load lazily, so
# file tracing would miss them). deploy/entrypoint.sh preloads it only when DD_AGENT_HOST is set.
RUN npm install --omit=dev --no-audit --no-fund --prefix /app/dd dd-trace@6.16.0 && chown -R node:node /app/dd
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["./entrypoint.sh"]
