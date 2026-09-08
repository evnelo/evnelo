# OpenTicket (working name)

Open-source event ticketing. An alternative to Luma, Partiful and Eventbrite that you can self-host with your own Stripe, Vonage and Resend keys, or use on the cloud edition at 0.99% on paid tickets and nothing on free ones.

Full product spec: `docs/PRD.md`.

## Stack

TypeScript everywhere. Next.js 15 (App Router, React 19), shadcn/ui on Tailwind v4 with a custom theme, MySQL 8 via Drizzle, Stripe (Payment Element + Connect), Vonage SMS, Resend email. pnpm + Turborepo monorepo.

```
apps/web          Next.js app: public pages, dashboard, REST API, webhooks
packages/db       Drizzle schema + migrations (MySQL)
packages/core     Business logic: fees, SMS gate, visibility, custom-field conditions + zod builder
packages/mcp      MCP server (stdio) over the REST API
```

## Run it

```bash
cp .env.example .env         # fill in keys; Stripe/Vonage/Resend are optional for free events without SMS/email
docker compose up db -d      # MySQL 8 on :3306
pnpm install
pnpm db:migrate              # migrations are committed; pnpm db:generate after schema changes
pnpm db:seed                 # optional demo org + events
pnpm dev                     # http://localhost:3000
```

Or everything in Docker: `docker compose up --build`.

Stripe webhooks locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

## Tests

```bash
pnpm test        # vitest — fee model, SMS gating, conditional fields
pnpm typecheck
```

## Wallet passes

Optional. Set the `APPLE_*` variables (Pass Type ID certificate, key, Apple WWDR cert, team id) to serve `.pkpass` files at `/t/{token}/wallet/apple`, and `GOOGLE_WALLET_ISSUER_ID` plus a service-account JSON to serve "Save to Google Wallet" links at `/t/{token}/wallet/google`. The buttons only appear on the ticket page when the keys are present.

## Editions

`EDITION=self_hosted` (default) or `EDITION=cloud`. Same code, one flag. Cloud adds the 0.99% platform fee, Stripe Connect onboarding, the $5 SMS unlock for free events, and the global discovery dashboard. See `packages/core/src/fees.ts` and `sms.ts` for the exact rules.

## Status

Foundation (M0) plus the first slice of M1/M2:

- [x] Schema for the whole PRD data model, migrations committed, `pnpm db:seed` demo data
- [x] Fee engine, refund proration, SMS gate, visibility rules (tested)
- [x] Custom fields: required/optional, per-ticket-type, conditional show/hide with builder-time validation; one zod schema used in the browser and on the server; separate question sets for the registrant, the order, and each guest
- [x] Guests (+1s): per-event toggle and limit; each guest is an attendee with their own ticket and QR, charged at the host's ticket price
- [x] Theme tokens, shadcn primitives, event page, registration modal, ticket page, discovery grid
- [x] Order creation with atomic inventory holds, hold release/expiry, one live registration per email, PaymentIntent with Connect application fee, Stripe webhook, free-order fulfilment
- [x] Ticket QR rendered locally, `.ics` calendar file, Apple Wallet (`.pkpass`) and Google Wallet passes (optional, key-gated)
- [x] MCP server skeleton (tools mapped to the REST API)
- [ ] Auth (Auth.js) and organizer dashboard
- [ ] REST API `/api/v1` handlers + OpenAPI spec
- [ ] Notification worker (email/SMS senders, reminders) and job runner
- [ ] Payment Element step after order creation
- [ ] Check-in scanner
- [ ] Event editor UI (fields builder, sponsors, hosts, guest settings)

Contributor and agent notes: `AGENTS.md`.

## MCP

```json
{ "mcpServers": { "openticket": { "command": "npx", "args": ["-y", "@ot/mcp"], "env": { "OPENTICKET_URL": "https://your-instance", "OPENTICKET_API_KEY": "ot_live_..." } } } }
```
