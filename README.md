# OpenTicket (working name)

Open-source event ticketing. An alternative to Luma, Partiful and Eventbrite that you can self-host with your own Stripe, Vonage and Resend keys, or use on the cloud edition at 0.99% on paid tickets and nothing on free ones.

Full product spec: `docs/PRD.md`.

## Stack

TypeScript everywhere. Next.js 15 (App Router, React 19), shadcn/ui on Tailwind v4 with a custom theme, MySQL 8 via Drizzle, Stripe (Payment Element + Connect), Vonage SMS (Messages API with an application key, or the legacy API key), Resend email. pnpm + Turborepo monorepo.

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
pnpm dev                     # http://localhost:3000 — sign in at /login; in development the magic link is also printed to the console
```

Or everything in Docker: `docker compose up --build`.

Stripe webhooks locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

## Tests

```bash
pnpm test        # vitest — fee model, SMS gating, conditional fields
pnpm typecheck
```

## Notifications

Every email and SMS is a row in `notifications`; a worker drains the queue. Self-hosted, the worker runs inside the web process every 10 seconds (`JOBS_INLINE=true`, the default). On serverless hosts set `JOBS_INLINE=false` and call `POST /api/jobs/run` with `Authorization: Bearer $AUTH_SECRET` from a cron every minute.

Templates are React Email components in `apps/web/emails`; preview them in development at `/dev/emails/registration_confirmation`, `/dev/emails/reminder`, `/dev/emails/approval_pending`, `/dev/emails/refund_issued` (add `?text=1` for the plain-text part).

Delivery status comes back through webhooks: point Resend at `/api/webhooks/resend` (set `RESEND_WEBHOOK_SECRET`) and, in the Vonage application, set the status URL to `/api/webhooks/vonage/status` and the inbound URL to `/api/webhooks/vonage/inbound` (STOP/START handling; `VONAGE_SIGNATURE_SECRET` verifies both).

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
- [x] Order creation with atomic inventory holds, hold release/expiry, one live registration per email, PaymentIntent with Connect application fee, Stripe webhook (paid, cancelled, refunded: full refunds revoke tickets and return seats), free-order fulfilment. Verified end to end in Stripe test mode.
- [x] Ticket QR rendered locally, `.ics` calendar file, Apple Wallet (`.pkpass`) and Google Wallet passes (optional, key-gated)
- [x] MCP server skeleton (tools mapped to the REST API)
- [x] Auth: magic-link email sign-in (Auth.js, React Email), Google when configured; first sign-in creates the organization; org roles (owner, admin, member, check-in) with invites by email
- [x] Organizer dashboard: events list with registrations, revenue and check-ins; event editor (venue, visibility, approval, guests, reminders, hosts, sponsors, tags, links); ticket types; registration form builder with conditional questions; attendees with search, approve/reject/cancel and CSV export; orders with Stripe refunds; org settings and members; public organization page `/o/{slug}`
- [x] Service layer in `packages/core/services` shared by the dashboard, the coming REST API, and the MCP server
- [ ] REST API `/api/v1` handlers + OpenAPI spec
- [x] Notification worker: React Email templates (confirmation, approval pending, refund, reminder), Vonage SMS with the free/paid gate, 24h/1h reminders, retries with backoff, Resend and Vonage delivery webhooks, STOP handling, reminder unsubscribe link. Runs in-process (`JOBS_INLINE=true`) or via `POST /api/jobs/run` from a cron.
- [ ] Payment Element step after order creation
- [ ] Check-in scanner
- [ ] Image uploads (covers, logos, avatars are URLs for now)

Contributor and agent notes: `AGENTS.md`.

## MCP

```json
{ "mcpServers": { "openticket": { "command": "npx", "args": ["-y", "@ot/mcp"], "env": { "OPENTICKET_URL": "https://your-instance", "OPENTICKET_API_KEY": "ot_live_..." } } } }
```
