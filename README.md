# Evnelo

**Events, in motion.** Open event infrastructure you can run yourself. Publish an event, sell or give away tickets, collect registrations with your own questions, email and text attendees, scan them in at the door. Free events are free. Paid tickets always run through the organizer's own Stripe account: the cloud edition takes 0.99% as an application fee at checkout and Stripe's processing applies on the organizer's account; self-hosting uses your own Stripe keys and has no platform fee at all.

Built with TypeScript end to end: Next.js 15 (App Router, React 19), Tailwind v4, MySQL 8 via Drizzle, Stripe, Resend for email, Vonage for SMS, S3-compatible storage for images. One database, one container, three optional API keys.

Brought to you by [InEvent](https://inevent.com). Conventions for contributors and coding agents are in `AGENTS.md`. Licensed under the Apache License 2.0.

## Features

**For attendees**
- Event pages at `/{organization}/{event}` with cover, schedule, venue and map link, hosts, sponsors, and a share card generated for every event.
- Registration in a dialog: ticket tiers, custom questions (conditional, per ticket type, per guest), guests (+1s) with their own tickets, discount codes, Stripe Payment Element for cards, Apple Pay, Google Pay, Pix and other local methods.
- Tickets with a QR code at `/t/{token}`, a calendar file, Apple Wallet and Google Wallet passes, and the join link for online events once confirmed.
- Waitlist when an event sells out, with timed offers when a seat frees up. Private events by invitation link.
- Discovery at `/discover`: search, city, tag, date, price and format filters, a calendar view, near-me, and a sitemap for public events only.
- Transactional email (React Email) and SMS: confirmation, approval, refund, reminders at 24h and 1h, event changes and cancellations, with STOP handling and an unsubscribe link.

**For organizers**
- Dashboard with events, registrations, revenue and check-in counts; an editor for schedule, venue with address autocomplete, visibility, approval, guests, capacity, reminders, hosts, sponsors, tags and links.
- Ticket types with quantities, sales windows and tax; discount codes; a registration form builder with conditional questions and file uploads.
- Attendees: search, approve or reject, cancel, export CSV, export or erase one person's data. Orders with full and partial Stripe refunds.
- Invitations for private events, waitlist promotion, outbound webhooks, scoped API keys, organization takeout and deletion.
- A door scanner that runs in the phone browser: camera QR scanning, search by name, undo, live counters, and offline operation with queued sync. A `checkin` role that sees nothing else.
- Roles: owner, admin, member, check-in staff. Sign-in by magic link, optionally Google.

**For developers**
- REST API under `/api/v1` covering every resource, with idempotent writes, pagination, rate limits, an OpenAPI 3.1 document and interactive docs at `/api/v1/docs`.
- `@evnelo/sdk`, a TypeScript client generated from the OpenAPI document, and an MCP server so agents can run events through the same API.
- Signed outbound webhooks for registrations, payments, refunds, check-ins and event changes.

## Getting started

Prerequisites: Node 22, pnpm 9, Docker (for MySQL).

```bash
git clone <this repo> evnelo && cd evnelo
cp .env.example .env          # defaults work for local development
docker compose up db -d       # MySQL 8 on localhost:3306
pnpm install
pnpm db:migrate               # apply the committed migrations
pnpm db:seed                  # optional: a demo organization with a few events
pnpm dev                      # http://localhost:3000
```

Sign in at `/login` with any email address. Without `RESEND_API_KEY` the magic link is printed in the terminal instead of emailed. The first sign-in creates your organization; the seeded demo organization can be joined by inviting yourself from its Settings once you are a member, or simply create your own.

Useful local URLs:

| URL | What |
|---|---|
| `/` | Marketing home with an illustrated event journey (three-then-two stages on tablets, stacked checkpoints on phones) |
| `/discover` | Public listing |
| `/dashboard` | Organizer dashboard |
| `/dashboard/checkin` | Door scanner |
| `/api/v1/docs` | API reference |
| `/dev/emails/registration_confirmation` | Email template previews (`?text=1` for the plain-text part) |
| `/api/health` | Health check |

Stripe locally: put test keys in `.env` and run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, then copy the printed signing secret into `STRIPE_WEBHOOK_SECRET`.

### Repository layout

```
apps/web           Next.js app: public pages, dashboard, REST API, webhooks, jobs
packages/core      Business rules (pure) and the server-only service layer used by the app, the API and MCP
packages/db        Drizzle schema, migrations, seed
packages/sdk       Generated TypeScript client (@evnelo/sdk)
packages/mcp       MCP server over the REST API
deploy/            Single-VM production stack (Caddy, app, MySQL) and backup script
```

Common commands from the repo root:

```bash
pnpm dev            # all packages in watch mode
pnpm build          # production build
pnpm test           # vitest in every package
pnpm typecheck
pnpm db:generate    # after editing packages/db/src/schema.ts
pnpm db:migrate
pnpm db:seed
pnpm --filter @evnelo/sdk generate   # regenerate the SDK after changing lib/openapi.ts
```

## Configuration

Everything is read from the environment (the root `.env` in development). Empty values count as unset. `.env.example` documents each variable; the essentials:

| Variable | Required | Notes |
|---|---|---|
| `APP_URL` | production | Public origin. Sign-in links, payment return URLs and share cards are built from it, never from the request host. |
| `AUTH_SECRET` | yes | 32+ random bytes. Signs sessions, payment-resume tokens and the jobs endpoint. |
| `DATABASE_URL` | yes | MySQL 8 connection string. |
| `EDITION` | no | `self_hosted` (default) or `cloud`. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET` | for email | Sending domain must be verified at Resend. Point Resend webhooks at `/api/webhooks/resend`. |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | for paid tickets | Register `/api/webhooks/stripe` in the Stripe dashboard. |
| `VONAGE_APPLICATION_ID` + `VONAGE_PRIVATE_KEY` (or `VONAGE_API_KEY` + `VONAGE_API_SECRET`), `VONAGE_FROM`, `VONAGE_SIGNATURE_SECRET` | for SMS | Status URL `/api/webhooks/vonage/status`, inbound URL `/api/webhooks/vonage/inbound`. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_BUCKET` | for uploads | `S3_ENDPOINT` for R2 or MinIO, `CLOUDFRONT_DOMAIN` to serve through a CDN, `S3_KEY_PREFIX` (default `evnelo`), `S3_UPLOAD_ACL=public-read` for ACL-style buckets. Without them the editor accepts image URLs. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | Adds Google sign-in. |
| `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT`, `APPLE_PASS_KEY`, `APPLE_PASS_KEY_PASSPHRASE`, `APPLE_WWDR_CERT` | no | Apple Wallet passes; the button appears only when set. |
| `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT` | no | Google Wallet passes. |
| `GEOCODER`, `PHOTON_URL`, `MAPBOX_TOKEN` | no | Address autocomplete: `photon` (default, public OSM instance), `mapbox`, or `none`. |
| `API_TRUSTED_PROXY_HEADER` | production | The header your proxy writes (`cf-connecting-ip`, `x-real-ip` or `x-forwarded-for`). Enables per-client rate limits on registration, sign-in and the public API. |
| `JOBS_INLINE` | no | `true` (default) runs the job loop inside the web process; `false` for serverless, then call `POST /api/jobs/run` with `Authorization: Bearer $AUTH_SECRET` every minute. |
| `MIGRATE_ON_START` | no | Apply migrations at boot (the Docker image sets it). |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT` | no | Error reporting. The public DSN is inlined at build time. |
| `ABUSE_EMAIL` | no | Where "Report this event" submissions are emailed. They are always stored. |
| `CAPTCHA_PROVIDER`, `CAPTCHA_SITE_KEY`, `CAPTCHA_SECRET_KEY` | production | Bot check on sign-in links, registrations, waitlist joins and abuse reports. `turnstile` (Cloudflare, free, invisible for most people) or `recaptcha` (Google reCAPTCHA v3). Off until all three are set. |

Storage needs a CORS rule on the bucket allowing `POST` from `APP_URL`, and objects under `evnelo/uploads/` must be publicly readable (bucket policy, CloudFront origin access, or the ACL setting). Registration file uploads live under `evnelo/registrations/` and stay private; they are served through an authenticated route.

## How it works

- **Orders and inventory.** Registration reserves seats with a conditional update, so flash sales cannot oversell. Paid orders hold seats for 10 minutes while the Payment Element completes; the Stripe webhook settles them, delayed payment methods sit in `processing` and are reconciled hourly, and a lapsed hold cancels the PaymentIntent before returning seats. A payment that lands after seats were released is refunded automatically. Event capacity is enforced at checkout under a row lock and includes active waitlist offers.
- **Guests.** Each +1 is a full attendee with their own ticket and QR, charged at the host's ticket price, asked the guest-scoped questions.
- **Access.** Public and unlisted events are open; private events need an invitation link, which is stored in an event-scoped cookie and checked both on the page and at checkout. Organization members always have access.
- **Notifications.** Every email and SMS is a row in `notifications`; the job loop sends them with retries and backoff, records provider status from the Resend and Vonage webhooks, and honours STOP. On the cloud edition, SMS for free events is a paid unlock; self-hosted instances send SMS whenever Vonage is configured.
- **Jobs.** The loop also expires holds, releases lapsed waitlist offers, schedules reminders, reconciles processing orders, delivers webhooks and purges housekeeping tables. Multiple replicas are safe: rows are claimed with conditional updates.
- **Check-in.** A check-in is a conditional insert, so two staff scanning the same ticket at once produce one check-in. The scanner keeps a manifest of hashed ticket tokens so it can validate offline and replays queued check-ins when back online.
- **Privacy.** Erasure anonymises in place (placeholders replace name, email, phone and answers; the ticket is revoked) so counts and financial records stay consistent. Organization deletion cancels events, revokes every ticket, erases everyone and disables keys and webhooks.

## API, SDK and MCP

Create keys under Dashboard → Settings → API keys (owners and admins). Keys are `ev_live_…`, sent as `Authorization: Bearer`, scoped `read` or `write`, and limited to 120 requests per minute with a separate throttle on failed authentication.

- Resources under `/api/v1`: organization, events (publish, cancel, stats), ticket types, registration fields, orders (refund), attendees (approve, reject, cancel, CSV), check-ins, discount codes, waitlist, invites, webhooks. `GET /api/v1/public/events` is unauthenticated and takes the same filters as `/discover`.
- Every write accepts an `Idempotency-Key`; replays return the original response with `Idempotency-Replayed: true`, a different body under the same key is a 409. Lists paginate with `limit`/`offset` and `pagination.nextOffset`. Bodies are capped at 256 KiB. Rate-limit headers are returned on every request that consumes quota.
- `GET /api/v1/openapi.json` is the contract; a test fails the build if a route is missing from it. `GET /api/v1/docs` is the interactive reference.
- `@evnelo/sdk` (`packages/sdk`): `createEvneloClient({ baseUrl, apiKey })` on openapi-fetch, plus `verifyWebhookSignature`.
- MCP (`packages/mcp`): list, get, create, update and publish events, ticket types, registrations, exports, stats and public search, through the SDK.

```json
{ "mcpServers": { "evnelo": { "command": "pnpm", "args": ["--filter", "@evnelo/mcp", "start"], "env": { "EVNELO_URL": "https://your-instance", "EVNELO_API_KEY": "ev_live_..." } } } }
```

### Outbound webhooks

Add endpoints under Settings → Webhooks and pick events: `registration.created`, `order.paid`, `order.refunded`, `attendee.checked_in`, `event.published`, `event.updated`, `event.cancelled`. Each delivery is a JSON envelope (`id`, `type`, `createdAt`, `organizationId`, `data`) signed with HMAC-SHA256 over `{timestamp}.{body}`, sent as `evnelo-signature: v1=…` with `evnelo-timestamp` and `evnelo-delivery-id`. Verify with the SDK helper and reject timestamps older than five minutes. Deliveries retry with exponential backoff up to eight attempts; the Settings page shows recent deliveries and can send a test ping or rotate the secret.

## Testing

```bash
pnpm test                       # all packages
pnpm --filter @evnelo/core test     # business rules, services, and integration tests
pnpm --filter @evnelo/web test      # app helpers, routes, OpenAPI contract
pnpm typecheck
```

Core integration tests (`packages/core/src/__tests__/*.integration.test.ts`) run against the local MySQL when it is reachable and skip otherwise; they prove the concurrency properties (rate limits, check-in, capacity) that mocks cannot. CI (`.github/workflows/ci.yml`) runs migrations, typecheck, tests and the production build against MySQL 8.4 on every push and pull request, and checks that the Docker image builds.

To exercise flows by hand: `pnpm db:seed` gives you events with paid and free tickets; Stripe test cards work in the Payment Element; the door scanner can be tested by pasting a ticket link into its manual field.

## Deploying

The Dockerfile produces a self-contained image (Next standalone server, traced production dependencies, static assets, migrations), about 300 MB, running as the unprivileged `node` user:

```bash
docker build -t evnelo .                      # add --build-arg NEXT_PUBLIC_SENTRY_DSN=… for browser error reporting
docker run -d -p 3000:3000 --env-file .env -e APP_URL=https://tickets.example.com evnelo
```

At boot the container applies pending migrations (`MIGRATE_ON_START=true`, serialised across replicas with a MySQL lock) and starts the job loop. It has a `HEALTHCHECK` on `/api/health`. `docker compose up --build` runs it against a MySQL container with the root `.env` for a one-box setup.

### One VM with Caddy (the evnelo.com setup)

`deploy/docker-compose.prod.yml` runs Caddy (automatic HTTPS from Let's Encrypt, `www` redirect), the app image and MySQL 8.4 on a single box; only Caddy publishes ports. On an Ubuntu VM with Docker installed, from the repository root:

```bash
cp .env.example .env           # fill in APP_URL=https://evnelo.com, AUTH_SECRET, Stripe, Resend, S3…
echo "MYSQL_PASSWORD=$(openssl rand -hex 24)" >> .env
echo "MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)" >> .env
docker compose --env-file .env -f deploy/docker-compose.prod.yml up -d --build
docker compose --env-file .env -f deploy/docker-compose.prod.yml logs -f app   # "ready" after migrations
```

`SITE_ADDRESS` in `.env` overrides the domain (default `evnelo.com`). The stack sets `API_TRUSTED_PROXY_HEADER=x-forwarded-for` because Caddy appends the client address to that header. To ship a new version: pull or sync the sources, run the same `up -d --build`; migrations apply on boot. `deploy/backup-db.sh` dumps the database nightly from cron and optionally copies it to S3.

Production checklist:

1. Set `APP_URL`, a fresh `AUTH_SECRET`, `DATABASE_URL`, and `API_TRUSTED_PROXY_HEADER` for your proxy.
2. Verify a sending domain at Resend and set `EMAIL_FROM` on it; register the Resend, Stripe and Vonage webhook URLs on the public domain.
3. Create a Turnstile widget (Cloudflare dashboard → Turnstile, any domain, no DNS change needed) or a reCAPTCHA v3 key pair for the domain and set the three `CAPTCHA_*` variables.
4. Configure the S3 bucket (CORS from `APP_URL`, public read on `evnelo/uploads/`, CloudFront optional).
5. Serve over HTTPS. HSTS, a Content Security Policy and the other security headers are set automatically when `APP_URL` is `https://`.
6. Several replicas: keep `MIGRATE_ON_START=true` (the lock handles it) and either leave `JOBS_INLINE=true` on one replica only or set it to `false` everywhere and hit `POST /api/jobs/run` from a cron.
7. Back up MySQL. Uploads live in your bucket; the database holds everything else.

Serverless hosts (Vercel and similar) work with `JOBS_INLINE=false` plus a scheduled call to `/api/jobs/run`; the standalone image is for VMs, Fly, Railway, ECS, Kubernetes and the like.

## Operations

- **Health:** `GET /api/health` returns `200` when the database answers within two seconds and the job loop ticked in the last two minutes (or jobs run externally), else `503`. Unauthenticated and terse.
- **Abuse limits:** registration, sign-in links, waitlist joins, discount previews and abuse reports are limited per identity and per event through one MySQL-backed limiter that holds across replicas. With `CAPTCHA_*` set, the four forms that send mail or hold inventory also need a Turnstile or reCAPTCHA token, verified server-side; a verification outage rejects rather than admits.
- **Navigation feedback:** a thin progress bar along the top edge shows while a clicked link is loading (`components/navigation-progress.tsx`).
- **Security headers:** every response carries a CSP allowing Stripe and your upload origin, `frame-ancestors 'none'`, nosniff, referrer and permissions policies, and HSTS on https. Built in `apps/web/lib/security-headers.js`.
- **Errors:** unexpected failures go through one helper that logs with a stable `[scope]` prefix and forwards to Sentry when configured. Notification retries are warnings; only a notification that exhausts its retries is an error.
- **Moderation:** "Report this event" on public pages stores a row and emails `ABUSE_EMAIL`.
- **Known follow-ups:** a sweep for registration files uploaded but never submitted, and Stripe Connect onboarding for the cloud edition.

## Contributing

Read `AGENTS.md` first; it holds the conventions that keep the codebase coherent (service layer in `packages/core`, one rate limiter, how access to private events is decided, the design rules for UI work, what must be updated when behaviour changes). Keep the README and `AGENTS.md` accurate in the same commit as a behaviour change.

## License

[Apache License 2.0](LICENSE). You can run, modify and redistribute Evnelo, including commercially, as long as you keep the license and notices; the license also grants a patent license from contributors.

Brought to you by [InEvent](https://inevent.com).
