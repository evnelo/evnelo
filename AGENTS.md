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

Env: copy `.env.example` to `.env` at the repo root. `next.config.ts`, `migrate.ts`, `seed.ts` and `drizzle.config.ts` load the root `.env` via `process.loadEnvFile` (already-set variables win). Free events need only `DATABASE_URL` and `AUTH_SECRET`. Stripe/Telnyx/Resend keys are optional until you touch paid orders, SMS, or email.

If turbo fails with `Malformed Mach-o file`, a truncated hoisted copy exists at `node_modules/@turbo/`; `rm -rf node_modules/@turbo` fixes it.

## Conventions

- IDs are 26-char ULIDs generated in code (`newId()` from `@ot/core`, `ulid()` in db scripts). No DB foreign keys; integrity is enforced in the service layer.
- Money is integer minor units plus ISO currency (`priceMinor`, `totalMinor`). Fee math only in `packages/core/src/fees.ts`.
- All datetimes are UTC in MySQL (`timezone: "Z"` on the pool); events carry an IANA `timezone` for display.
- Custom registration fields: rule tree in `registration_fields.condition`; visibility resolved by `visibleFieldKeys`; `buildAnswersSchema` is the single zod schema used by the browser form and by `POST /api/orders`. Hidden fields are stripped, never validated. A field may only depend on fields positioned before it.
- Inventory: `ticket_types.sold` and `held`. Free orders increment `sold` immediately; paid orders increment `held` for a 10-minute hold and move to `sold` in `markOrderPaid` (Stripe webhook). Reservation is a conditional UPDATE, not a SELECT then INSERT. `releaseOrder` gives a hold back (PaymentIntent creation failed, `payment_intent.canceled`, or expiry); `expireHolds` sweeps lapsed holds and runs before every new order until a job runner exists. A late `payment_intent.succeeded` on an `expired` order still issues tickets.
- Refunds: `applyRefund` (charge.refunded) records partial refunds only; a full refund cancels the party, revokes its tickets, returns seats to `sold`, and queues `refund_issued`. Idempotent on replay.
- SMS: `lib/sms.ts` wraps the Telnyx Messaging API behind `SmsProvider` with plain fetch (no SDK). Configured when `TELNYX_API_KEY` and `TELNYX_FROM` are set. Keep other providers behind the same interface; don't add provider SDKs.
- One live registration per email per event, enforced in `POST /api/orders` (emails are lowercased). Cancelled/rejected attendees and expired/failed/refunded orders don't count. Guest emails count too.
- Guests: `events.guestsEnabled` + `events.maxGuests`. `POST /api/orders` takes `guests: [{ name, email?, answers }]`; each guest becomes an `attendees` row with `guestOfAttendeeId` set, its own ticket, the host's ticket type and price (order quantity = 1 + guests), and answers validated against `scope: "guest"` fields. A guest without an email carries the host's email and gets no separate confirmation row. Don't model guests as a count on the host; per-person tickets are what make check-in and capacity work.
- Wallet passes: `lib/wallet/` builds an Apple `.pkpass` (passkit-generator) and a Google "save" JWT (jose). Both are gated by `appleWalletConfigured` / `googleWalletConfigured` from `lib/env.ts`; routes 404 when keys are absent. Pass artwork is a flat placeholder until org artwork upload exists.
- Notifications are rows in `notifications` (status `queued`); nothing sends yet. Do not send email/SMS inline from request handlers.
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

## Known gaps (as of 2026-09-08)

Not implemented yet, though some are linked from the UI: auth and `/login`, `/dashboard`, org page `/o/{slug}`, `/api/v1/*` (so the MCP server has nothing to talk to), notification worker and job runner, Payment Element step after order creation, check-in scanner, event editor. See the README status list before adding anything, and update it when you ship a piece.

Ticket QR codes are rendered locally at `/t/{token}/qr` (SVG). Calendar files come from `/api/calendar/{slug}.ics` for public and unlisted events only. Wallet passes: `/t/{token}/wallet/apple` and `/t/{token}/wallet/google`.
