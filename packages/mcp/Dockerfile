# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/mcp/package.json packages/mcp/
COPY packages/sdk/package.json packages/sdk/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --filter @evnelo/mcp...
COPY packages/mcp packages/mcp
COPY packages/sdk packages/sdk
COPY apps/web/messages apps/web/messages
COPY apps/web/i18n/locales.ts apps/web/i18n/locales.ts
RUN pnpm --filter @evnelo/mcp exec tsx scripts/build.ts

# Only bundled public transport and immutable UI. No source, pnpm, env files or organizer entrypoint.
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/packages/mcp/dist/ ./
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node healthcheck.mjs
CMD ["node", "http-server.mjs"]
