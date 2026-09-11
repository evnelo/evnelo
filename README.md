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

Upgrades that include discovery-index migrations can rebuild MySQL indexes. On a large existing installation, check free disk space and run `pnpm db:migrate` in a maintenance window before deploying the new web process. `APP_URL` is required in production: sign-in links and payment return URLs are built from it, never from the request host.

Stripe webhooks locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

## Tests

```bash
pnpm test        # vitest — core business rules and API primitives
pnpm typecheck
pnpm build
```

## REST API

The first `/api/v1` slice is available for event discovery and organizer automation:

- `GET /api/v1/public/events` — public event search by text, city, or tag; no authentication required
- `GET /api/v1/events` — list the API key's organization events, optionally filtered by status
- `POST /api/v1/events` — create a draft event; accepts an optional `Idempotency-Key` retained for 24 hours
- `GET /api/v1/events/{id}` — get an organization event with ticket types, tags, hosts, sponsors, and registration fields
- `GET /api/v1/openapi.json` — OpenAPI 3.1 document for the implemented endpoints
- `GET /api/v1/docs` — interactive Scalar API reference backed by the published OpenAPI document

Create keys under Dashboard → Settings → API keys (owners and admins). Organization endpoints use `Authorization: Bearer ot_live_...` with `read` or `write` scopes and enforce a per-key limit of 120 requests per minute; failed authentication attempts are throttled separately. Rate-limit headers (`X-RateLimit-*`, reset as unix seconds) are returned on every request that consumes quota, and list endpoints paginate with `limit`/`offset` plus `pagination.nextOffset`. JSON request bodies are capped at 256 KiB. Public discovery uses indexed MySQL full-text search behind a 3,000-request-per-minute global ceiling; set `API_TRUSTED_PROXY_HEADER` to the header your proxy writes (`cf-connecting-ip`, `x-real-ip` or `x-forwarded-for`, last hop) to add a 60-per-minute limit per client. API keys are SHA-256 hashed at rest and shown once at creation. The remaining resources used by the MCP skeleton are still pending.

## Image storage

Uploads never pass through the web process: the browser asks `/api/uploads` for a presigned S3 POST and sends the file to the bucket directly, then confirms so the server can verify size and type. Set `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` and `S3_BUCKET` (the SDK-standard `AWS_*` names are accepted too); add `S3_ENDPOINT` for R2, MinIO or another S3-compatible store, and `CLOUDFRONT_DOMAIN` to serve images through CloudFront. Every object is written under `S3_KEY_PREFIX` (default `openticket`), so the bucket can be shared with other applications. The bucket needs a CORS rule allowing `POST` from your `APP_URL`, and objects under `openticket/` must be publicly readable: a bucket policy, CloudFront origin access in front of a private bucket, or, for buckets that still use object ACLs, `S3_UPLOAD_ACL=public-read` so each upload is written with that ACL. Without these variables the editor accepts image URLs instead.

## Notifications

Every email and SMS is a row in `notifications`; a worker drains the queue. Self-hosted, the worker runs inside the web process every 10 seconds (`JOBS_INLINE=true`, the default). On serverless hosts set `JOBS_INLINE=false` and call `POST /api/jobs/run` with `Authorization: Bearer $AUTH_SECRET` from a cron every minute.

Templates are React Email components in `apps/web/emails`; preview them in development at `/dev/emails/registration_confirmation`, `/dev/emails/reminder`, `/dev/emails/approval_pending`, `/dev/emails/refund_issued` (add `?text=1` for the plain-text part).

Delivery status comes back through webhooks: point Resend at `/api/webhooks/resend` (set `RESEND_WEBHOOK_SECRET`) and, in the Vonage application, set the status URL to `/api/webhooks/vonage/status` and the inbound URL to `/api/webhooks/vonage/inbound` (STOP/START handling; `VONAGE_SIGNATURE_SECRET` verifies both).

## Wallet passes

Optional. Set the `APPLE_*` variables (Pass Type ID certificate, key, Apple WWDR cert, team id) to serve `.pkpass` files at `/t/{token}/wallet/apple`, and `GOOGLE_WALLET_ISSUER_ID` plus a service-account JSON to serve "Save to Google Wallet" links at `/t/{token}/wallet/google`. The buttons only appear on the ticket page when the keys are present.

## Editions

`EDITION=self_hosted` (default) or `EDITION=cloud`. Same code, one flag. Cloud adds the 0.99% platform fee, Stripe Connect onboarding, the $5 SMS unlock for free events, and the global discovery dashboard. See `packages/core/src/fees.ts` and `sms.ts` for the exact rules.

## Delivery sequence

This is the canonical implementation order and cross-session progress tracker. Update it whenever an item starts, ships, or becomes blocked.

**Status legend:** `[ ]` pending · `[>]` in progress · `[x]` shipped · `[!]` blocked

**Resume here:** Item 2 — Check-in scanner, manual check-in, and undo (not started).

1. [x] **Payment Element and paid-checkout completion**
   - Existing foundation: atomic 10-minute inventory holds, PaymentIntent creation, Stripe webhooks, fees/tax calculation, and dashboard refunds.
   - Complete when buyers can confirm payment in the registration flow, recover from failures, see a clear success state/receipt, and the flow is verified end to end in Stripe test mode.
2. [ ] **Check-in scanner, manual check-in, and undo**
   - Complete when authorized check-in staff can scan signed ticket QR codes from a phone, search and check in manually, undo a check-in, and see synchronized counters; short offline operation must fail safely and resync.
3. [ ] **Private-event invitations and access enforcement**
   - Complete when organizers can issue/revoke event invitations and private event pages plus registration validate an invite token or authorized membership while remaining `noindex`.
4. [ ] **Waitlist enrollment and promotion**
   - Complete when sold-out events can collect waitlist entries, organizers can promote them without overselling, promotion expires safely, and required email/SMS notifications are queued.
5. [ ] **Discount-code checkout and management**
   - Complete when organizers can create/manage percentage and fixed discounts with expiry and usage limits, checkout validates and applies them atomically, and orders preserve the discount audit trail.
6. [ ] **REST API/MCP parity, API-key UI, and outbound webhooks**
   - Complete when the documented organizations, events, ticket types, registration fields, orders, attendees/tickets, check-ins, discounts, and webhook resources exist; MCP tools call real endpoints; organizers can manage scoped keys/webhooks; TypeScript SDK generation and signed retrying outbound deliveries are available.
7. [ ] **Discovery search, filters, calendar, and sitemap**
   - Complete when `/discover` supports query/city/tag/date/free-or-paid/location filters, list and calendar views, near-me discovery, featured/upcoming sections, and public-only sitemap/SEO coverage.
8. [ ] **Complete uploads with S3/R2 and remaining image fields**
   - Existing foundation: direct-to-S3 presigned uploads for event covers and logos (verified 2026-09-10 against a real bucket behind CloudFront), keys under `openticket/`, size/type verified after upload.
   - Complete when organization logos, host avatars, sponsor logos, registration file fields, crop controls, and persistent S3-compatible Cloud storage are implemented.
9. [ ] **Health endpoint, registration abuse controls, and privacy workflows**
   - Complete when health/readiness checks, registration/login abuse limits, Cloud moderation/reporting, and attendee/org PII export plus hard deletion are implemented and documented.
10. [ ] **README/PRD reconciliation and release-readiness matrix**
    - Complete when implementation claims, package names, providers, storage behavior, routes, P0/P1 status, deployment instructions, accessibility/performance checks, and remaining post-launch work are accurately reflected in both documents.

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
- [x] Organizer dashboard: events list with registrations, revenue and check-ins; event editor (venue, visibility, approval, guests, reminders, hosts, sponsors, tags, links); ticket types; registration form builder with conditional questions; attendees with search, approve/reject/cancel and CSV export; orders with Stripe refunds; org settings and members; public organization page `/o/{slug}` and event pages at `/{org}/{event}` (event slugs are unique per organization)
- [x] Service layer in `packages/core/services` shared by the dashboard, the coming REST API, and the MCP server
- [x] REST API foundation: public event search plus authenticated event list/get/create, scoped API keys managed from Settings, per-key and auth-failure rate limits, pagination, transactional idempotency for event creation, a published OpenAPI 3.1 document, and an interactive Scalar API reference
- [ ] Complete REST API resource coverage, generated TypeScript SDK, and outbound webhooks
- [x] Notification worker: React Email templates (confirmation, approval pending, refund, reminder), Vonage SMS with the free/paid gate, 24h/1h reminders, retries with backoff, Resend and Vonage delivery webhooks, STOP handling, reminder unsubscribe link. Runs in-process (`JOBS_INLINE=true`) or via `POST /api/jobs/run` from a cron.
- [x] Stripe Payment Element after order creation: signed redirect recovery, server-confirmed success, a `processing` state for delayed payment methods with hourly reconciliation against Stripe, and hold expiry that cancels the PaymentIntent before releasing seats (a payment that lands after seats were released is refunded automatically)
- [ ] Check-in scanner
- [x] Image uploads go straight from the browser to S3 (or any S3-compatible bucket) with a presigned POST; CloudFront URLs when configured; event covers and logos today, organization logos, host avatars and sponsor logos still accept URLs

Contributor and agent notes: `AGENTS.md`.

## MCP

```json
{ "mcpServers": { "openticket": { "command": "npx", "args": ["-y", "@ot/mcp"], "env": { "OPENTICKET_URL": "https://your-instance", "OPENTICKET_API_KEY": "ot_live_..." } } } }
```
