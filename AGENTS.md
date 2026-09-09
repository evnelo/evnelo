# AGENTS.md

Guidance for AI agents and new contributors working in this repo. Product spec lives in `docs/PRD.md`; setup and status in `README.md`. Keep this file short and operational.

## What this is

OpenTicket: open-source event ticketing (Luma/Eventbrite alternative). One codebase, two editions selected by `EDITION=self_hosted|cloud`. Cloud adds the 0.99% platform fee, Stripe Connect, the $5 SMS unlock for free events, and global discovery. Self-hosted never charges a platform fee.

## Layout

```
apps/web          Next.js 15 App Router (React 19). Public pages, /api routes, Stripe webhook.
packages/db       Drizzle schema (MySQL 8), migrations in packages/db/drizzle, migrate + seed scripts.
packages/core     Pure business logic: fees, SMS gate, visibility, custom-field conditions + zod builder. Unit tested.
packages/mcp      MCP server (stdio). Thin client over the REST API at /api/v1 (API not implemented yet).
```

Dependency direction: `web -> core -> db`. `core` must stay free of Next/React/Stripe imports so it can be shared by the browser, route handlers, the REST API and the MCP server. `db` cannot import `core`.

## Commands

```bash
docker compose up db -d          # MySQL 8 on :3306 (needs a root .env to exist, even for db only)
pnpm install
pnpm db:generate                 # drizzle-kit: schema -> packages/db/drizzle/*.sql (commit the output)
pnpm db:migrate                  # apply migrations
pnpm db:seed                     # demo org + 4 events (free w/ conditional fields, paid, private, draft). Idempotent.
pnpm dev                         # http://localhost:3000 (turbo). Or: pnpm --filter @ot/web dev
pnpm test                        # vitest in packages/core
pnpm typecheck                   # tsc in every package
pnpm build                       # next build
```

Env: copy `.env.example` to `.env` at the repo root. `next.config.ts`, `migrate.ts`, `seed.ts` and `drizzle.config.ts` load the root `.env` via `process.loadEnvFile` (already-set variables win). Free events need only `DATABASE_URL` and `AUTH_SECRET`. Stripe/Vonage/Resend keys are optional until you touch paid orders, SMS, or email.

If turbo fails with `Malformed Mach-o file`, a truncated hoisted copy exists at `node_modules/@turbo/`; `rm -rf node_modules/@turbo` fixes it.

## Where things live

- `packages/core/src/services/*`: every business operation as `fn(db, ...)`. Zod inputs (`eventInput`, `ticketTypeInput`, `registrationFieldsInput`, `organizationInput`) live next to them and are reused by server actions; the REST API and MCP should reuse them too. Import from `@ot/core/services` on the server only. Browser-safe constants and helpers (`slugify`, `can`, `FIELD_TYPES`, `SOCIAL_PLATFORMS`) come from `@ot/core`.
- `apps/web/app/(public)`: public pages with the marketing header. `apps/web/app/dashboard`: organizer UI with its own layout; `actions.ts` holds every server action, each of which re-checks the session and org membership (`requireOrg`, `requireEvent` in `lib/dashboard.ts`).
- `apps/web/auth.ts`: Auth.js config; `lib/auth/adapter.ts` maps Auth.js onto our tables; `lib/auth/session.ts` has `currentUser`, `requireUser`, `requireOrg`. The current org is a cookie (`ot_org`), defaulting to the first membership.
- Dashboard client components are in `components/dashboard`. Forms post JSON to server actions and show `ActionResult` messages; datetime-local inputs are wall-clock in the event's time zone (`lib/tz.ts`).

## Conventions

- IDs are 26-char ULIDs generated in code (`newId()` from `@ot/core`, `ulid()` in db scripts). No DB foreign keys; integrity is enforced in the service layer.
- Money is integer minor units plus ISO currency (`priceMinor`, `totalMinor`). Fee math only in `packages/core/src/fees.ts`.
- All datetimes are UTC in MySQL (`timezone: "Z"` on the pool); events carry an IANA `timezone` for display.
- Custom registration fields: rule tree in `registration_fields.condition`; visibility resolved by `visibleFieldKeys`; `buildAnswersSchema` is the single zod schema used by the browser form and by `POST /api/orders`. Hidden fields are stripped, never validated. A field may only depend on fields positioned before it.
- Inventory: `ticket_types.sold` and `held`. Free orders increment `sold` immediately; paid orders increment `held` for a 10-minute hold and move to `sold` in `markOrderPaid` (Stripe webhook). Reservation is a conditional UPDATE, not a SELECT then INSERT. `releaseOrder` gives a hold back (PaymentIntent creation failed, `payment_intent.canceled`, or expiry); `expireHolds` sweeps lapsed holds and runs before every new order until a job runner exists. A late `payment_intent.succeeded` on an `expired` order still issues tickets.
- Refunds: `applyRefund` (charge.refunded) records partial refunds only; a full refund cancels the party, revokes its tickets, returns seats to `sold`, and queues `refund_issued`. Idempotent on replay.
- SMS: `lib/sms.ts` wraps Vonage behind `SmsProvider`. Application ID + private key (Messages API) is preferred; API key + secret (legacy SMS API) still works. `smsAuthMode` in `lib/env.ts` picks one.
- Correlated subqueries in drizzle `sql` templates must reference the outer table by raw name (`events.id`, `orders.id`); `${events.id}` renders as a bare `id` inside a single-table select and MySQL binds it to the inner table.
- Roles: `can(role, action)` in core is the only permission table. Server actions check it; pages hide controls with the same call. Never trust a hidden button.
- One live registration per email per event, enforced in `POST /api/orders` (emails are lowercased). Cancelled/rejected attendees and expired/failed/refunded orders don't count. Guest emails count too.
- Guests: `events.guestsEnabled` + `events.maxGuests`. `POST /api/orders` takes `guests: [{ name, email?, answers }]`; each guest becomes an `attendees` row with `guestOfAttendeeId` set, its own ticket, the host's ticket type and price (order quantity = 1 + guests), and answers validated against `scope: "guest"` fields. A guest without an email carries the host's email and gets no separate confirmation row. Don't model guests as a count on the host; per-person tickets are what make check-in and capacity work.
- Wallet passes: `lib/wallet/` builds an Apple `.pkpass` (passkit-generator) and a Google "save" JWT (jose). Both are gated by `appleWalletConfigured` / `googleWalletConfigured` from `lib/env.ts`; routes 404 when keys are absent. Pass artwork is a flat placeholder until org artwork upload exists.
- Notifications are rows in `notifications`; request handlers only insert `queued` rows, never send. `lib/notifications/worker.ts` claims rows with a conditional UPDATE (`queued` → `sending`), delivers via `deliver.ts`, retries with backoff (`retryDelayMs`, 5 attempts), and requeues rows stuck in `sending`. `scheduleReminders` upserts reminder rows by `dedupeKey` for events in the next 8 days. The loop starts from `instrumentation.ts` (keep the import inside the `NEXT_RUNTIME === "nodejs"` check) or runs from `POST /api/jobs/run`.
- Email templates are React Email components in `apps/web/emails`, rendered with `renderEmail` (html + plain text). Add a template: component + subject helper in `emails/`, a case in `deliver.ts`, and a sample in `app/dev/emails/[template]/route.ts`. SMS templates stay in `lib/sms.ts`, variables only.
- The SMS gate (`smsGate` in core) runs at delivery time, not enqueue time, so a cloud free event that buys the $5 unlock later still gets its queued texts.
- Provider webhooks: `/api/webhooks/resend` (Svix HMAC), `/api/webhooks/vonage/status` and `/inbound` (JWT with `payload_hash`). Signature checks are in the route files; keep them there and keep them failing closed when a secret is configured.
- REST API: implemented endpoints are documented at `/api/v1/openapi.json`. Organization routes authenticate SHA-256-hashed keys, enforce read/write scopes and a 120-request/minute per-key limit, return rate-limit headers after quota consumption, and cap JSON bodies at 256 KiB. Public discovery uses MySQL full-text indexes plus per-client/global throttles; reverse proxies must overwrite forwarded-IP headers. Event creation is always transactional; using `Idempotency-Key` also claims and completes the key in the operation transaction, and expired keys may be reused after 24 hours.
- Visibility: `public` is indexed, `unlisted` is link-only with `noindex`, `private` requires membership or invite. `canView`/`robotsFor`/`isDiscoverable` in `packages/core/src/visibility.ts` are the only place these rules live.
- UI: shadcn primitives in `apps/web/components/ui`, theme tokens in `apps/web/app/globals.css`. Fraunces for display type (`.display`), Geist for UI. House accent is green; per-event accent via `--accent-event`. No gradients, glassmorphism, or purple.
- TypeScript strict with `noUncheckedIndexedAccess`. Zod v3.

## Testing a change

1. `pnpm test && pnpm typecheck`.
2. For anything touching orders or fields, seed and hit the API directly:
   ```bash
   curl -X POST localhost:3000/api/orders -H 'content-type: application/json' \
     -d '{"eventId":"<id>","ticketTypeId":"<id>","name":"A","email":"a@x.com","attendee":{"role":"eng"},"order":{"code_of_conduct":true}}'
   ```
   Then check `orders`, `attendees`, `tickets`, `notifications` in MySQL (`docker exec openticket-db-1 mysql -uopenticket -popenticket openticket`).
3. Stripe locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET`.

## Docs to keep current

When you ship or change behaviour, update in the same commit: the README status list, `docs/PRD.md` where a product decision changed, and this file's conventions/gaps sections.

## Known gaps (as of 2026-09-09)

The REST API currently covers public event search and authenticated event list/get/create; the remaining resources expected by the MCP server, API-key management UI, SDK generation, and outbound webhooks are not implemented yet. Other gaps: Payment Element step after order creation (paid registrations get a client secret and stop), check-in scanner, image uploads, waitlist, discount codes UI, Stripe Connect onboarding for Cloud, and an org switcher beyond the cookie default. Test data: `pnpm db:seed` creates the demo org but no user; sign in with any email and create your own org. See the README status list before adding anything, and update it when you ship a piece.

Ticket QR codes are rendered locally at `/t/{token}/qr` (SVG). Calendar files come from `/api/calendar/{slug}.ics` for public and unlisted events only. Wallet passes: `/t/{token}/wallet/apple` and `/t/{token}/wallet/google`.
