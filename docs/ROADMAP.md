# Roadmap and delivery history

The shipped-feature list and the delivery sequence that got the project to v1 (moved out of the README on 2026-09-11). Post-launch work is at the end of the sequence.

## Delivery sequence (complete)

This is the canonical implementation order and cross-session progress tracker. Update it whenever an item starts, ships, or becomes blocked.

**Status legend:** `[ ]` pending · `[>]` in progress · `[x]` shipped · `[!]` blocked

**Resume here:** the delivery sequence is complete (2026-09-10). Next: staging deployment and the post-launch list at the end of this section.

1. [x] **Payment Element and paid-checkout completion**
   - Existing foundation: atomic 10-minute inventory holds, PaymentIntent creation, Stripe webhooks, fees/tax calculation, and dashboard refunds.
   - Complete when buyers can confirm payment in the registration flow, recover from failures, see a clear success state/receipt, and the flow is verified end to end in Stripe test mode.
2. [x] **Check-in scanner, manual check-in, and undo**
   - Shipped 2026-09-10: `/dashboard/checkin/{event}` scans ticket QR codes with the phone camera (jsQR), checks in by name from the confirmed list, undoes, shows live counters, and keeps working without signal (hashed ticket manifest on the device, queued check-ins replay when back online). Check-in is race-safe (conditional insert). The `checkin` role sees only this area.
3. [x] **Private-event invitations and access enforcement**
   - Shipped 2026-09-10: the Invites tab issues email-bound or shareable links (`/i/{token}`, use budget, expiry, revoke); opening a link stores it in an event-scoped cookie; the event page and `POST /api/orders` both go through `eventAccess` (organization member, or valid invite; email-bound invites must match the registrant; uses are spent atomically inside the order transaction). Private pages stay `noindex` and 404 to everyone else. Online/hybrid tickets show the join link to confirmed attendees.
4. [x] **Waitlist enrollment and promotion**
   - Shipped 2026-09-10: sold-out (ticket quantities or event capacity, which checkout now enforces under a row lock) shows "Join the waitlist"; the Waitlist tab offers a spot per person, which holds one seat (counted against capacity) for 24 hours and emails a claim link (`/w/{token}`); claiming converts the held seat inside the order transaction, email-bound; the job loop releases lapsed offers so they can be offered again. Joining sends a confirmation email.
5. [x] **Discount-code checkout and management**
   - Shipped 2026-09-10: percent or fixed codes with use limits and expiry are managed on the Tickets tab; the checkout form validates a code through `POST /api/discounts/validate` and shows the new total (a 100% code makes the order free, no payment step); `POST /api/orders` re-validates, spends the use with a conditional update inside the order transaction, and stores `discountMinor` + `discountCodeId` on the order; a use is returned when a pending order expires or fails.
6. [x] **REST API/MCP parity, API-key UI, and outbound webhooks**
   - Shipped 2026-09-10: 35 documented `/api/v1` paths covering the organization, events (incl. publish/cancel/stats), ticket types, registration fields, orders (incl. refund), attendees (incl. approve/reject/cancel and CSV), check-ins, discount codes, waitlist, invites and webhooks; `Idempotency-Key` on every write; the OpenAPI document is contract-tested against the route tree; `@ot/sdk` is generated from it (openapi-fetch client plus webhook signature verification); the MCP server calls the API through the SDK; outbound webhooks are signed and retried. API-created invites and waitlist offers return the link but do not send email; refunds return 202 and settle through the Stripe webhook.
7. [x] **Discovery search, filters, calendar, and sitemap**
   - Shipped 2026-09-10: `/discover` with query, city, tag, date presets/range, free/paid, online/in-person and near-me (browser geolocation → `lat`/`lng`/`radius`) filters, list and month-calendar views (`view=calendar`, days in each event's own time zone), Featured and Upcoming sections, load-more pagination, `ItemList` JSON-LD; `sitemap.xml` (public published events and organization pages only) and `robots.txt` (dashboard, API, ticket, invite and waitlist links disallowed). The public REST search takes the same filters.
8. [x] **Complete uploads with S3/R2 and remaining image fields**
   - Shipped 2026-09-10: the same direct-to-S3 field now serves organization logos, host avatars and sponsor logos (compact variants) with a 16:7 crop for covers; registration `file` fields upload straight to a private prefix (`openticket/registrations/{eventId}/`, no ACL, 10 MB, PDF/JPEG/PNG/WebP), store the object key as the answer, are HEAD-verified at submission, and are downloaded from the Attendees tab through an authenticated route that redirects to a two-minute presigned GET. Files uploaded but never submitted are not swept yet (add a lifecycle rule or a sweep).
9. [x] **Health endpoint, registration abuse controls, and privacy workflows**
   - Shipped 2026-09-10: `/api/health`; registration, sign-in, waitlist, discount-preview and report limits; per-attendee JSON export and irreversible erasure (placeholders replace name/email/phone/answers, ticket revoked, queued mail dropped, order contact anonymised when nobody live shares it) from the Attendees tab; organization takeout (`/dashboard/settings/export`) and owner-only deletion (cancels events, revokes tickets, erases everyone, disables keys and webhooks); "Report this event" on every public event page stores a report and emails `ABUSE_EMAIL` when set.
10. [x] **README/PRD reconciliation and release-readiness matrix**
    - Done 2026-09-10 with the merges above. Remaining post-launch work, in suggested order: Stripe Connect onboarding for Cloud; SMS templates for waitlist/invite flows; per-ticket-type discount restrictions; automatic waitlist promotion on cancellation; a moderation queue UI for abuse reports; a sweep for orphaned registration uploads; nonce-based CSP; organizer broadcast emails (`send_attendee_update` in MCP); `tz` cookie for discovery date presets; hosted SDK docs.

## Shipped

- [x] Home page (2026-09-11): marketing landing at `/` with the tagline, pricing band (free events $0, paid 0.99%, self-hosted $0), the flow, open-source and developer sections, upcoming public events; Discover becomes a secondary page
- [x] Hero refinement (2026-09-11): rising ribbon with aligned checkpoints, straight preview cards centered on their checkpoints, a local concert cover and QR asset; a three-then-two tablet journey and readable stacked journey on phones with a separate avatar row, content-driven desktop button clearance that adapts to copy and section width, and reduced-motion support.

- [x] Public navigation (2026-09-11): GitHub icon with `evnelo/evnelo` text on every public route and viewport, standard navigation-link styling, and a two-row small-screen header with matching Discover filter offset.

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
- [x] Outbound webhooks: per-organization endpoints subscribed to `registration.created`, `order.paid`, `order.refunded`, `attendee.checked_in`, `event.published|updated|cancelled`; HMAC-SHA256 signed (`evnelo-signature: v1=…` over `{timestamp}.{body}`), delivered by the job loop with exponential backoff, managed in Settings (test ping, pause, rotate secret, recent deliveries)
- [x] REST API: every resource under `/api/v1` with `Idempotency-Key`, pagination, contract-tested OpenAPI, Scalar docs; `@ot/sdk` generated client; MCP tools on the SDK
- [x] Uploads everywhere: org logo, host avatars, sponsor logos, cover crop; private registration file fields with authenticated downloads
- [x] Notification worker: React Email templates (confirmation, approval pending, refund, reminder), Vonage SMS with the free/paid gate, 24h/1h reminders, retries with backoff, Resend and Vonage delivery webhooks, STOP handling, reminder unsubscribe link. Runs in-process (`JOBS_INLINE=true`) or via `POST /api/jobs/run` from a cron.
- [x] Stripe Payment Element after order creation: signed redirect recovery, server-confirmed success, a `processing` state for delayed payment methods with hourly reconciliation against Stripe, and hold expiry that cancels the PaymentIntent before releasing seats (a payment that lands after seats were released is refunded automatically)
- [x] Design system (2026-09-11): `docs/DESIGN.md` direction, warm tokens, CSS-only motion, refreshed primitives, editorial public pages (discover, event, registration, ticket, organizer, auth), dashboard chrome kit and door scanner, branded emails, favicon and generated Open Graph cards
- [x] Privacy: attendee data export and erasure, organization takeout and deletion, abuse reports (`/report`, `ABUSE_EMAIL`)
- [x] Discount codes: percent/fixed, use limits, expiry; validated and spent atomically at checkout; audit trail on the order
- [x] Waitlist: join when sold out, organizer-driven offers that hold a seat for 24h, claim links, automatic release; event capacity enforced at checkout
- [x] Private events: invitation links (email-bound or shareable, use budget, expiry) enforced on the page and at checkout; members always have access
- [x] Check-in scanner: camera QR scanning, manual check-in by search, undo, live counters, offline manifest with queued sync; race-safe conditional insert; `checkin` role lands on `/dashboard/checkin`
- [x] Image uploads go straight from the browser to S3 (or any S3-compatible bucket) with a presigned POST; CloudFront URLs when configured; event covers and logos today, organization logos, host avatars and sponsor logos still accept URLs

