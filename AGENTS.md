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
- Inventory: `ticket_types.sold` and `held`. Free orders increment `sold` immediately; paid orders increment `held` for a 10-minute hold and move to `sold` in `markOrderPaid`. Reservation is a conditional UPDATE, not a SELECT then INSERT. A payment is applied whenever the order still holds its seats (`pending`, even past the advertised deadline) or is `processing`; `expireHolds` (job loop) cancels the PaymentIntent at Stripe *before* releasing a lapsed hold, so a success on an already-released order is the rare race that `settlePaymentIntent` refunds. Delayed methods (bank debits) move the order to `processing` with no deadline; `reconcileProcessingOrders` re-checks them with Stripe hourly in case the terminal webhook never arrived. Releasing an unpaid order cancels its attendees too.
- Paid checkout: `RegisterForm` creates the held order, then `RegisterCard` switches to `PaymentStep` (Stripe Payment Element, created against the connected account when the intent lives on one). The browser never asserts success: every completion, inline or after a redirect, goes through `POST /api/orders/resume`, which verifies the signed resume token plus client secret, asks Stripe for the intent's real status, settles the order server-side and returns the state. `lib/orders.ts#settlePaymentIntent` is the one mapping from Stripe status to order state; the webhook, the resume endpoint, the sweep and reconciliation all call it. Resume credentials live in per-event `sessionStorage` and are stripped from the URL immediately.
- Refunds: `applyRefund` (charge.refunded) records partial refunds only; a full refund cancels the party, revokes its tickets, returns seats to `sold`, and queues `refund_issued`. Idempotent on replay.
- SMS: `lib/sms.ts` wraps Vonage behind `SmsProvider`. Application ID + private key (Messages API) is preferred; API key + secret (legacy SMS API) still works. `smsAuthMode` in `lib/env.ts` picks one.
- Correlated subqueries in drizzle `sql` templates must reference the outer table by raw name (`events.id`, `orders.id`); `${events.id}` renders as a bare `id` inside a single-table select and MySQL binds it to the inner table.
- Roles: `can(role, action)` in core is the only permission table. Server actions check it; pages hide controls with the same call. Never trust a hidden button.
- One live registration per email per event, enforced in `POST /api/orders` (emails are lowercased). Cancelled/rejected attendees and expired/failed/refunded orders don't count. Guest emails count too.
- Guests: `events.guestsEnabled` + `events.maxGuests`. `POST /api/orders` takes `guests: [{ name, email?, answers }]`; each guest becomes an `attendees` row with `guestOfAttendeeId` set, its own ticket, the host's ticket type and price (order quantity = 1 + guests), and answers validated against `scope: "guest"` fields. A guest without an email carries the host's email and gets no separate confirmation row. Don't model guests as a count on the host; per-person tickets are what make check-in and capacity work.
- Wallet passes: `lib/wallet/` builds an Apple `.pkpass` (passkit-generator) and a Google "save" JWT (jose). Both are gated by `appleWalletConfigured` / `googleWalletConfigured` from `lib/env.ts`; routes 404 when keys are absent. Pass artwork is a flat placeholder until org artwork upload exists.
- Image uploads are direct-to-S3: `POST /api/uploads` (signed in, `edit_events`, same-origin, rate limited) returns a presigned POST whose policy pins `{S3_KEY_PREFIX}/uploads/{orgId}/` (prefix defaults to `openticket`; `uploadPrefix()` in `lib/storage.ts`), the content type, a 5 MB cap and, when `S3_UPLOAD_ACL` is set, the object ACL; the browser posts the file to the bucket; `PUT /api/uploads` confirms by HEAD (wrong size/type gets deleted) and returns the URL to store. `lib/storage.ts` owns the S3 client, key layout and public URLs (CloudFront when `CLOUDFRONT_DOMAIN` is set, `S3_ENDPOINT` for compatible stores); credentials come from `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`/`S3_REGION`, falling back to the `AWS_*` names. Bytes never touch the web process. `storageConfigured` gates the UI; without S3 the editor shows a URL input.
- Address autocomplete goes through the `searchAddressesAction` server action (`GEOCODER=photon|mapbox|none`); provider keys never reach the browser and venue text is sent to the provider, so `none` is the privacy option.
- Notifications are rows in `notifications`; request handlers only insert `queued` rows, never send. `lib/notifications/worker.ts` claims rows with a conditional UPDATE (`queued` → `sending`), delivers via `deliver.ts`, retries with backoff (`retryDelayMs`, 5 attempts), and requeues rows stuck in `sending`. `scheduleReminders` upserts reminder rows by `dedupeKey` for events in the next 8 days. The loop starts from `instrumentation.ts` (keep the import inside the `NEXT_RUNTIME === "nodejs"` check) or runs from `POST /api/jobs/run`.
- Email templates are React Email components in `apps/web/emails`, rendered with `renderEmail` (html + plain text). Add a template: component + subject helper in `emails/`, a case in `deliver.ts`, and a sample in `app/dev/emails/[template]/route.ts`. SMS templates stay in `lib/sms.ts`, variables only.
- The SMS gate (`smsGate` in core) runs at delivery time, not enqueue time, so a cloud free event that buys the $5 unlock later still gets its queued texts.
- Provider webhooks: `/api/webhooks/resend` (Svix HMAC), `/api/webhooks/vonage/status` and `/inbound` (JWT with `payload_hash`). Signature checks are in the route files; keep them there and keep them failing closed when a secret is configured.
- REST API: implemented endpoints are documented at `/api/v1/openapi.json` (keep the schemas complete; an SDK is generated from them). Organization routes authenticate SHA-256-hashed keys (created in Settings), enforce read/write scopes, a 120-request/minute per-key limit and a separate throttle on failed authentication, return rate-limit headers after quota consumption, paginate with `limit`/`offset`, and cap JSON bodies at 256 KiB. `consumeRateLimit` in core is the only rate limiter (one atomic upsert per call; buckets are 26-char hashes); table housekeeping (`purgeApiHousekeeping`) runs from the job loop, never inside request transactions. Public discovery has a global ceiling and, only when `API_TRUSTED_PROXY_HEADER` names the header the proxy writes, a per-client limit. `FULLTEXT` indexes come from a hand-written migration drizzle can't express; see the note in `schema.ts`. Event creation is transactional; `Idempotency-Key` claims and completes inside the same transaction and expired keys are reusable after 24 hours.
- Check-in lives in `packages/core/src/services/checkin.ts` (`checkInTicket` is a conditional `INSERT … WHERE NOT EXISTS` so concurrent scans of one ticket yield one row; `parseTicketToken` accepts raw tokens and ticket URLs), `apps/web/lib/checkin-access.ts` (membership + `check_in`, independent of the org cookie), the JSON routes under `app/api/checkin/[eventId]` (POST/DELETE need a same-origin Origin header; the manifest GET ships token hashes only) and `components/dashboard/check-in-scanner.tsx` (jsQR decode loop, localStorage manifest + offline queue). Raw `sql` DATETIME subqueries come back as strings; convert them with `fromDbDatetime`. The scanner pages live outside the event layout because `requireEvent` needs `view_events`.
- Deployment: `next.config.ts` sets `output: "standalone"` with the monorepo root as tracing root; the Dockerfile copies `.next/standalone`, `.next/static`, `public` and `packages/db/drizzle`. `lib/migrate.ts` runs drizzle's migrator at boot (from `instrumentation.ts`, guarded by `MIGRATE_ON_START` and a `GET_LOCK` on a dedicated connection); it finds the folder relative to the process cwd or via `DB_MIGRATIONS_DIR`. Keep the runner stage free of pnpm and sources.
- Private events: `lib/event-access.ts` is the single answer to "may this visitor see or register for this event" (membership via session, invite via the `ot_inv_{eventId}` cookie that `/i/{token}` sets). Use it in any new public surface for events; never re-derive access from the cookie elsewhere. Invite uses are consumed with a conditional update inside the order transaction, so refusals are race-safe.
- Waitlist (`packages/core/src/services/waitlist.ts`): a promoted entry holds a seat in `ticket_types.held` and counts against capacity via `activeWaitlistHolds`; `capacityAllows` locks the event row (`FOR UPDATE`) and is the only capacity check, called from the order route and from promotion. `consumeWaitlistOffer` releases the held seat inside the same transaction that reserves it again, so there is no window where the seat can be taken by someone else. `expireWaitlistOffers` runs from the job loop. Offer cookies come from `/w/{token}` (`lib/waitlist-access.ts`).
- Discount codes (`packages/core/src/services/discounts.ts`): `discountProblem` is the single validity rule (used by the preview route and checkout); `consumeDiscountCode` spends a use inside the order transaction and `releaseOrder` gives it back for dead orders. The fee engine (`computeOrder`) applies the discount before tax and platform fee.
- Outbound webhooks: emit from core services with `emitWebhookEvent(tx, organizationId, type, payload)` inside the transaction that produced the fact (see fulfilment, events, checkin); payload builders live in `services/webhook-payloads.ts` and are part of the public contract, so change them additively. Delivery is `lib/notifications/webhooks.ts` from the job loop: claim (atomic), POST with `openticket-signature`, `recordWebhookAttempt`. Never follow redirects with a signed body. Consumers verify with `verifyWebhookSignature` (the SDK ships a copy).
- Discovery (`packages/core/src/discovery.ts` + `listPublicEvents`): filters are parsed from URL params by pure helpers with tests; near-me is Haversine in SQL over the varchar lat/lng with a regexp guard; `/discover` is fully server-rendered and `force-dynamic`.
- Privacy (`packages/core/src/services/privacy.ts`): erasure never deletes rows other records point to; it overwrites personal fields with `ERASED_NAME` / `erasedEmail(id)` and sets `deletedAt`. Anything new that stores personal data (a column, a JSON blob, a log line) must be covered by `eraseAttendee`, `deleteOrganization` and the two export functions, or it leaks past a deletion request.
- REST API: routes under `apps/web/app/api/v1` use the helpers in `lib/api.ts` (`apiRoute`, `parseQuery`/`parseBody`, `requireOrgEvent`, `mutate` for idempotent writes) and the serializers in `lib/api-serializers.ts` (never secrets). `lib/openapi.test.ts` fails on any route or method missing from `lib/openapi.ts`, so document as you add. After changing the document run `pnpm --filter @ot/sdk generate` and commit `packages/sdk/openapi.json` + `src/schema.d.ts`. List queries for the API live in `packages/core/src/services/listings.ts`.
- Registration file fields store an object key under `{S3_KEY_PREFIX}/registrations/{eventId}/` (private, no ACL); `packages/core/src/fields/files.ts` validates shape and event binding, `apps/web/lib/registration-uploads.ts` plans uploads, and the download route re-checks membership before a short presigned GET. Never turn these keys into public URLs. `.gitignore` roots the `uploads/` rule (`/uploads/`) because `apps/web/app/api/uploads` is application code.
- Design: read `docs/DESIGN.md` before touching UI. Tokens and motion utilities live in `apps/web/app/globals.css`; primitives in `components/ui`; dashboard page kit in `components/dashboard/page-chrome.tsx`; public narrow pages use `components/narrow-page.tsx`. Open Graph cards are `app/opengraph-image.tsx` and the event route's `opengraph-image.tsx`, rendered with the static TTFs in `apps/web/assets/fonts` (satori cannot read woff2 or variable fonts).
- Errors: call `captureError(scope, error, context)` from `lib/observability.ts` instead of `console.error`; it logs and forwards to Sentry when `SENTRY_DSN` is set. Scopes are dotted code paths (`jobs.expireHolds`); context holds ids, never emails. Client boundaries (`app/error.tsx`, `app/global-error.tsx`) only report errors without a `digest`, because server errors are already captured by `instrumentation.onRequestError`.
- Security headers live in `apps/web/lib/security-headers.js` (CommonJS on purpose: Next compiles `next.config.ts` in isolation and drops static imports of local modules, so the config `require`s it by absolute path). Add new third-party origins there, with a test.
- Public entry points get abuse limits via `consumeSharedRateLimit(scope, identity, limit, windowMs)`; the client identity comes from `clientAddress`/`clientAddressFromHeaders` and is `null` unless `API_TRUSTED_PROXY_HEADER` is configured, so always pair a per-client limit with a limit that needs no identity.
- Dependencies: drizzle-orm has an optional peer on `@opentelemetry/api`. Any package that pulls that peer in (Sentry does) makes pnpm build a second drizzle-orm variant and every `SQL` type stops matching across packages. `@ot/db` and `@ot/core` declare `@opentelemetry/api` as a dev dependency to keep one variant; keep that in place.
- Tests: `apps/web` has a vitest config with the `@/` alias and a setup file that provides env; `packages/core/src/__tests__/*.integration.test.ts` run against the docker MySQL when it is reachable and skip otherwise. Prefer those over mocks that assert statement order.
- Event slugs are unique per organization (`ev_org_slug`), never globally; every public lookup takes the (organization slug, event slug) pair (`getEventByOrgAndSlug`). Legacy `/e/{slug}` and `/api/calendar/{slug}.ics` links resolve to the oldest event with that slug (`findEventForLegacySlug`) and redirect to the canonical path. Build event URLs with `publicEventPath` and calendar URLs with `calendarPath`.
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

## Known gaps (as of 2026-09-10)

The REST API currently covers public event search and authenticated event list/get/create; the remaining resources expected by the MCP server, SDK generation, and outbound webhooks are not implemented yet. Other gaps: check-in scanner, uploads for org logos/host avatars/sponsor logos and S3 storage, waitlist, discount codes UI, Stripe Connect onboarding for Cloud, private-event invitations, and an org switcher beyond the cookie default.  Test data: `pnpm db:seed` creates the demo org but no user; sign in with any email and create your own org. See the README status list before adding anything, and update it when you ship a piece.

Ticket QR codes are rendered locally at `/t/{token}/qr` (SVG). Calendar files come from `/api/calendar/{slug}.ics` for public and unlisted events only. Wallet passes: `/t/{token}/wallet/apple` and `/t/{token}/wallet/google`.
