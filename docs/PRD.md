# PRD — Open-Source Event Ticketing Platform

**Working name:** _TBD_ (referred to below as "the Platform")
**Status:** Draft v0.2 (guests and wallet passes added 2026-09-08)
**Date:** 2026-09-08
**Owner:** Mauricio Giordano

---

## 1. Summary

The Platform is an open-source alternative to Luma, Partiful and Eventbrite. Anyone can self-host it with their own Stripe, Vonage and Resend keys and run free or paid events end to end. A cloud edition, operated by us, offers the same product with hosting, a public discovery dashboard, and a fee model that undercuts incumbents: **0.99% on paid tickets, nothing on free tickets**, with the option to bring your own Stripe account so the customer keeps control of their money and their payout schedule.

Aesthetically it sits in the Luma family (clean, image-forward event pages, low friction registration) while having its own identity: warmer, more editorial, and deliberately not another dark-mode-gradient app.

## 2. Problem

- Eventbrite takes 3.7% + $1.79 per paid ticket plus a 2.9% processing fee; Luma takes 5% on paid tickets. For community organizers, meetups, small conferences and creators, that is the single largest cost line after the venue.
- Luma and Partiful are closed. Organizers can't self-host, can't own their attendee data end to end, can't extend the product, and are subject to pricing changes.
- Existing open-source options (Pretix, Hi.Events, Attendize) are either operationally heavy, visually dated, or lack a modern registration experience, a public discovery surface, and an agent-ready API.

## 3. Goals

1. Ship a fully open-source (MIT/AGPL — see Open Questions) event ticketing product that a single developer can deploy with one MySQL database and three API keys.
2. Run a cloud edition with materially lower fees than incumbents, funded by a 0.99% take on paid tickets and a flat $5 SMS unlock on free events.
3. Match or beat Luma on time-to-first-event and time-to-register.
4. Expose everything through an open REST API and an MCP server so events can be created, managed and queried by agents.
5. Public discovery dashboard where indexed events are browsable and searchable by anyone.

### Non-goals (v1)

- Marketing SMS / SMS campaigns. SMS is strictly transactional.
- Marketing email campaigns (newsletters, drip). Transactional email only.
- Seating charts / reserved seating.
- Native mobile apps (web is mobile-first; check-in works from a phone browser).
- Multi-currency settlement beyond what Stripe supports natively.
- Ticket resale / secondary market.
- Venue or vendor marketplace.

## 4. Editions

| | **Open source (self-hosted)** | **Cloud** |
|---|---|---|
| Hosting | User's infra | Ours |
| Stripe | User's own keys (required for paid events) | Bring your own account via Stripe Connect, or use platform account |
| SMS | User's own Vonage keys | Included per pricing rules |
| Email | User's own Resend key | Included, free |
| Discovery dashboard | Local to that instance (optional, off by default) | Global, public |
| Platform fee | None | 0.99% on paid tickets |
| Updates | Git / Docker image | Continuous |

One codebase, one feature flag (`EDITION=self_hosted | cloud`). The cloud edition adds billing, fee collection, global discovery, abuse controls and multi-tenant isolation. Everything else is identical, so there is no "open core" gap in the event product itself.

## 5. Pricing & fee model (Cloud)

### 5.1 Tickets

| Scenario | Stripe processing fee | Platform fee | Who pays Stripe |
|---|---|---|---|
| Free ticket | none | **0** | — |
| Paid ticket, organizer brings own Stripe | Stripe standard (on organizer's account) | **0.99%** of ticket price | Organizer, directly to Stripe |
| Paid ticket, organizer uses platform Stripe | Stripe standard | **0.99%** | Deducted before payout |

- Fees are computed on the gross ticket price (excluding taxes the organizer configures separately).
- Organizer chooses per event whether to absorb fees or pass them to the buyer (line item "Service fee" on checkout).
- Refunds: platform fee is returned on full refunds within Stripe's refund window; Stripe's own fees follow Stripe policy.

### 5.2 SMS (transactional only)

| Event type | Cloud SMS | Self-hosted |
|---|---|---|
| Paid event | Included, unlimited transactional SMS | BYO keys |
| Free event | **$5 flat per event** unlocks unlimited transactional SMS for that event | BYO keys |

"Transactional" = confirmation, ticket link, reminder (24h / 1h, organizer-configurable), check-in confirmation, event update/cancellation. No promotional content; templates are fixed with organizer-editable variables only.

A fair-use ceiling (e.g. 5 SMS per attendee per event, and a hard cap per event tied to registrations) protects against abuse. See Open Questions.

### 5.3 Email

Free on Cloud. Self-hosted brings a Resend key. Same transactional-only scope as SMS.

### 5.4 Fee collection mechanics

- **Platform Stripe account:** charges run on our account; 0.99% is retained; payouts to the organizer via Stripe Connect Express transfers.
- **Bring your own Stripe:** organizer connects a **Stripe Connect Standard** account via OAuth. Charges run on *their* account (they see everything in their Stripe dashboard, control payouts, disputes, tax). We collect 0.99% via `application_fee_amount` on each PaymentIntent. This is the cleanest way to get "bring your own keys" semantics on Cloud while still collecting the fee automatically.
- **Self-hosted:** raw secret/publishable keys in env; no application fee logic.

## 6. Users

| Persona | Needs |
|---|---|
| **Community organizer** (meetups, clubs) | Free events, fast setup, RSVP list, reminders, check-in from phone |
| **Paid-event organizer** (workshops, small conferences, creators) | Ticket tiers, low fees, own Stripe payouts, custom registration questions, refunds |
| **Company / DevRel** | Company logo, sponsors, private/invite-only events, API integration with their CRM |
| **Attendee** | Register in under 60 seconds, get a ticket by email/SMS, add to calendar, find events nearby |
| **Developer / self-hoster** | Docker-compose up, env vars, clear docs, MCP server for automation |
| **Agent** (via MCP) | Create/update events, list registrations, export attendees, check event availability |

## 7. Functional requirements

Priority: **P0** = required for launch, **P1** = fast follow, **P2** = later.

### 7.1 Accounts & organizations

- P0 Email magic-link + Google OAuth sign-in. Optional password. _(Decided 2026-09-09: no password at all in v1; Auth.js with JWT sessions, magic link is the primary path, Google optional per instance.)_
- P0 Organizations (workspaces). A user can belong to many; every event belongs to one org.
- P0 Roles: Owner, Admin, Member (create/edit events), Check-in staff (scan only).
- P0 Org profile: name, slug, logo, website, social links. Org public page lists its public events.
- P1 Org-level branding defaults (accent color, logo) inherited by events.

### 7.2 Event creation & management

Event fields (all P0 unless noted):

- Name, slug (`/{organizationSlug}/{eventSlug}`; event slugs are unique within an organization, so two organizations can both run `/summit`), start/end datetime with timezone, optional multi-day sessions (P1)
- Description — rich text (headings, lists, links, images, embeds) with Markdown import/export
- Venue: in-person (address, map, geocoded lat/lng), online (link revealed after registration), or hybrid
- Cover image (16:9 and square crop), company/host logo
- Tags (free-form + curated taxonomy for discovery)
- Social media links: website, X, LinkedIn, Instagram, YouTube, Discord, Bluesky, Threads, TikTok, Mastodon, generic URL
- Sponsors: ordered list, each with name, logo, tier label (optional), website and social links. Rendered as a sponsor strip on the event page.
- Hosts: one or more people shown on the page (name, avatar, title, social)
- Capacity (per event and per ticket type), waitlist toggle
- Visibility: **Public** (indexed in discovery + search engines), **Unlisted** (link only, `noindex`), **Private / invite-only** (requires invite token or approved email; not indexed)
- Registration approval: automatic or manual (organizer approves each registrant)
- Status: draft → published → (cancelled | ended)
- P1 Event duplication and templates
- P1 Recurring events
- P1 Custom domain per org (Cloud paid add-on TBD)

### 7.3 Ticket types

- P0 Multiple ticket types per event; each has name, description, price (0 = free), currency, quantity, sales window, min/max per order, visibility (public / hidden by access code)
- P0 Free and paid ticket types can coexist on one event. Event is "paid" for fee purposes if any purchased ticket had price > 0; SMS pricing is evaluated per event based on whether *any* ticket type is paid.
- P0 Discount codes (percentage / fixed, usage limits, expiry)
- P1 Group tickets, donation "pay what you want"
- P2 Add-ons (merch, meals)

### 7.4 Registration & custom fields

- P0 Registration form per event, built from a field library:
  - Types: short text, long text, email, phone, number, single select, multi select, checkbox, date, URL, file upload (P1), consent/terms checkbox
  - Each field: label, help text, placeholder, **required / optional toggle**, per-ticket-type applicability
  - **Conditional logic:** show field X when field Y {equals, not equals, contains, is empty, is not empty} value. Conditions can chain (AND/OR groups, one level deep in v1). Required-ness is only enforced when the field is visible.
- P0 Default fields always present: name, email; phone is opt-in per event (needed for SMS)
- P0 Per-attendee vs per-order answers (buying 3 tickets can collect 3 names)
- P0 **Guests (+1s).** Per-event toggle "allow guests" with "max guests per registration" (default 1). A guest is a full attendee record linked to the host attendee (`attendees.guest_of_attendee_id`) with their **own ticket and QR**, so check-in and capacity count every person. Guests answer a dedicated **guest** question set (fields with scope `guest`), not the host's questions. Guest email is optional: with one, the guest gets their own ticket email; without, the ticket is delivered to the host. On paid events each guest is charged the **host's ticket type price** (the order is simply quantity 1 + guests on one ticket type), so fees, refunds and holds need no special casing. Approval-required events approve or reject the whole party with the host. A guest's email is subject to the same one-registration-per-email rule as a registrant.
- P0 Field answers exportable as CSV, filterable in the dashboard, exposed via API
- P1 Field library reusable across events in an org

### 7.5 Checkout & payments

- P0 Stripe Checkout / Payment Element embedded in the registration flow (cards, Apple/Google Pay, Pix and local methods where the organizer's Stripe account supports them)
- P0 Order holds: inventory reserved for 10 minutes during checkout
- P0 Fee display: absorbed or passed to buyer
- P0 Receipts, order history, refund (full/partial) from organizer dashboard; refund policy text per event
- P0 Webhook-driven order state (`pending → paid → refunded | failed`), idempotent
- P0 Tax: organizer enters a tax rate per ticket type (Stripe Tax integration P1)
- P1 Stripe Connect payout visibility in dashboard

### 7.6 Tickets & check-in

- P0 Each attendee gets a ticket with a signed QR code; ticket page at `/t/{token}` with add-to-calendar (Google, Apple/ICS, Outlook)
- P0 **Add to Apple Wallet / Google Wallet.** Apple: signed `.pkpass` event ticket generated on the instance (Pass Type ID certificate + WWDR cert from the operator's Apple Developer account). Google: "Save to Google Wallet" JWT link signed with a service account (issuer id from the Google Wallet console); the class and object are embedded in the JWT so no API round-trip is needed. Both are optional and hidden until the keys are configured; Cloud ships them enabled. QR payload is the same `/t/{token}` URL so one scanner handles paper, screen and wallet.
- P0 Web check-in scanner (camera-based, works offline for a short window, syncs back)
- P0 Manual check-in by search; undo check-in
- P0 Live check-in counter on the event dashboard
- P1 Badge PDF export

### 7.7 Notifications

Email (Resend), all transactional, P0:

- Registration confirmation (with ticket), order receipt, approval / rejection, waitlist promoted, event reminder (24h and 1h; organizer chooses), event updated (time/venue change), event cancelled, refund issued, magic-link login, org invite
- Organizer-authored "update to attendees" message — plain transactional blast limited to registered attendees, rate-limited, must be event-related

SMS (Vonage), transactional, P0:

- Confirmation + ticket link, reminder, event update/cancellation
- Requires attendee phone opt-in at registration; STOP handling and country compliance (sender ID rules per country)
- Gated by the SMS pricing rules in §5.2; organizer sees SMS status ("included" / "unlock for $5") on the notifications tab

Attendee preferences: per-attendee unsubscribe from reminders; confirmations always send.

### 7.8 Discovery dashboard

- P0 Public `/discover` page: featured, upcoming near me (browser geolocation or manual city), by tag, search (name, tag, city, org)
- P0 Only **Public** events are indexed; unlisted and private never appear, in search results or sitemaps
- P0 SEO: server-rendered event pages, Open Graph / Twitter cards from cover image, JSON-LD `Event` schema, sitemap
- P0 Calendar view and list view, filters: date range, free/paid, online/in-person, tags
- P1 City landing pages (`/discover/sao-paulo`), tag pages
- P1 Follow an org / get notified of new events (email only)
- P2 Personalized recommendations
- Self-hosted: discovery is scoped to that instance and disabled by default.

### 7.9 Organizer dashboard

- P0 Event list with status, registrations, revenue, check-ins
- P0 Per-event: overview (sales over time, ticket type breakdown), attendees (search, filter by field answers, approve/reject, export CSV), orders & refunds, notifications, settings
- P0 Org settings: members & roles, Stripe connection, notification keys (self-hosted), API keys, webhooks
- P1 Embeddable registration widget / button for external sites

### 7.10 Open API

- P0 REST, JSON, versioned (`/api/v1`), OpenAPI 3.1 spec published and used to generate the TypeScript SDK
- P0 Auth: org-scoped API keys (scoped read/write), plus OAuth for third-party apps (P1)
- P0 Resources: organizations, events, ticket types, registration fields, orders, attendees/tickets, check-ins, discount codes, webhooks
- P0 Public read endpoints for public events (no auth) — powers discovery and third-party listings
- P0 Outbound webhooks: `registration.created`, `order.paid`, `order.refunded`, `attendee.checked_in`, `event.published`, `event.updated`, `event.cancelled` — signed, retried with backoff
- P0 Rate limiting per key; idempotency keys on writes

### 7.11 MCP server

- P0 Ships as a package (`@platform/mcp`) and as a hosted remote MCP endpoint on Cloud (Streamable HTTP, OAuth)
- P0 Tools: `list_events`, `get_event`, `create_event`, `update_event`, `publish_event`, `list_ticket_types`, `create_ticket_type`, `list_registrations`, `export_attendees`, `get_event_stats`, `search_public_events`, `send_attendee_update`
- P0 Resources: event as Markdown, attendee CSV
- P0 Destructive/paid actions (cancel event, refund, send update) require explicit confirmation parameter
- Built on the same service layer as the REST API — no parallel logic

### 7.12 Self-hosting

- P0 Single Docker image + `docker-compose.yml` (app + MySQL). Env vars: `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `VONAGE_FROM`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `AUTH_SECRET`, `STORAGE_*` (S3-compatible or local)
- P0 First-run setup wizard creates the owner and org _(implemented as: first sign-in lands on /onboarding, which creates the organization and makes the signer its owner; no separate wizard)_
- P0 Migrations run on boot; health endpoint
- P1 One-click deploy templates (Railway, Render, Fly, Coolify)

## 8. Technical architecture

### 8.1 Stack

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere (strict) |
| Web | React 19 via **Next.js (App Router)** — server components for public/SEO pages, client components for dashboard; React Server Actions + route handlers |
| UI | **shadcn/ui** on Tailwind v4, custom theme (§9); Radix primitives underneath |
| Forms | react-hook-form + zod; the custom-field builder and renderer share one zod schema generator |
| Database | **MySQL 8** with Drizzle ORM (typed schema, SQL-first migrations); on Cloud, PlanetScale or Aurora MySQL |
| Payments | **Stripe** (Payment Element, Connect Standard + Express, webhooks, Tax P1) |
| SMS | **Vonage** Messages API behind a `SmsProvider` interface. Chosen because Vonage's shared, pre-registered US number pool means self-hosters don't need 10DLC or toll-free registration to reach US phones. |
| Email | **Resend** with React Email templates |
| Auth | Auth.js (magic link, Google); API keys hashed at rest |
| Jobs | MySQL-backed queue (reminders, webhook delivery, SMS/email sending) — no Redis dependency for self-hosters; BullMQ optional on Cloud |
| Storage | S3-compatible (R2 on Cloud), direct browser uploads via presigned POST, CloudFront in front; all keys under `S3_KEY_PREFIX` (default `openticket`) so one bucket can be shared; no local-disk mode |
| Search | MySQL full-text for v1; Meilisearch optional adapter for Cloud discovery |
| Maps | Mapbox/Google geocoding behind an interface; static map on event page |
| Testing | Vitest, Playwright for checkout and check-in flows, Stripe test clocks |
| Repo | Monorepo (pnpm + Turborepo): `apps/web`, `packages/db`, `packages/core` (services), `packages/api-sdk`, `packages/mcp`, `packages/email` |

### 8.2 Service layer

All business logic lives in `packages/core` and is consumed by three thin transports: Next.js route handlers/server actions, the REST API, and the MCP server. This guarantees the API and MCP can do everything the UI can.

### 8.3 Data model (core tables)

`users`, `organizations`, `organization_members`, `events`, `event_hosts`, `event_sponsors`, `event_social_links`, `sponsor_social_links`, `tags`, `event_tags`, `ticket_types`, `discount_codes`, `registration_fields`, `registration_field_conditions`, `orders`, `order_items`, `attendees` (guests link to their host via `guest_of_attendee_id`), `attendee_field_answers`, `tickets`, `check_ins`, `invites`, `waitlist_entries`, `notifications` (log of every email/SMS with provider id + status), `sms_unlocks` (event_id, paid_at, stripe_payment_id), `api_keys`, `webhooks`, `webhook_deliveries`, `stripe_accounts`.

Notes:
- Money stored as integer minor units + ISO currency.
- All datetimes UTC; event stores its IANA timezone.
- Soft delete on events and attendees; hard delete of PII on request (GDPR/LGPD).
- Every table multi-tenant by `organization_id` with row-level checks in the service layer.

### 8.4 Custom-field conditional engine

- Conditions stored as a JSON rule tree per field: `{ op: "and" | "or", rules: [{ field_id, operator, value }] }`
- Evaluated client-side for live show/hide and server-side on submit (server is the source of truth; hidden fields are stripped and not validated as required)
- Field builder prevents cycles and forward references to fields that appear later in the form

### 8.5 Payments flow

1. Client creates order (holds inventory) → server creates PaymentIntent on the appropriate Stripe account (`stripeAccount` header when organizer-connected) with `application_fee_amount = round(gross × 0.0099)` on Cloud
2. Payment Element confirms
3. `payment_intent.succeeded` webhook → order `paid` → attendees/tickets issued → confirmation email + SMS enqueued
4. Hold expiry job releases inventory for unpaid orders

### 8.6 Notification delivery

- Every send goes through `notifications` table → queue → provider adapter → provider webhook updates status (delivered / bounced / failed)
- SMS gate: `event.isPaid || smsUnlocks.exists(event) || edition === self_hosted`
- Templates: React Email for email; short, variable-only templates for SMS (160-char budget, no links shortened through third parties — use `/t/{token}`)
- Job runner (decided 2026-09-09): no Redis. The web process polls `notifications` every 10s (`JOBS_INLINE`), claiming rows with a conditional UPDATE so multiple replicas are safe; serverless deployments call `POST /api/jobs/run` from a cron. Reminders are upserted per attendee/hour/channel with a dedupe key so moving an event reschedules them. Guests sharing the host's email are covered by the host's emails (one email per address, listing every ticket).

### 8.7 Security & compliance

- Signed QR tokens (HMAC, per-ticket, revocable)
- Webhook signature verification (Stripe, Vonage, Resend)
- API keys: prefix + SHA-256 hash, scopes, last-used tracking, rotation
- Rate limits on registration, login, API
- Abuse controls on Cloud: new orgs limited until first successful paid event or manual review; spam-event detection on discovery; report button
- PII export & delete per attendee and per org (GDPR / LGPD)
- SMS compliance: opt-in checkbox, STOP handling, country sender-ID rules, quiet hours for reminders
- CSP, CSRF on actions, dependency scanning in CI

### 8.8 Non-functional

- Event page TTFB < 200 ms (edge-cached, revalidated on publish)
- Checkout p95 < 2 s excluding Stripe round-trip
- Registration flash-sale target: 500 registrations/min per event without oversell (row-level locking on ticket inventory)
- 99.9% uptime target on Cloud
- Accessibility: WCAG 2.1 AA on public pages and checkout
- i18n-ready from day one (English at launch; Portuguese next)

## 9. Design & theme

Reference point is Luma: big cover image, calendar-style date block, host row, single clear register button, generous whitespace, and a registration modal instead of a page change. The Platform keeps that structure but must not look like a shadcn default install or a dark purple-gradient template.

**Direction — "editorial, warm, precise":**

- **Typography:** a distinctive display face for event titles and headings (e.g. Instrument Serif, Fraunces or Newsreader) paired with a neutral grotesk for UI (e.g. Inter Tight or Geist). Titles set large with tight leading. This is the single biggest lever for not looking templated.
- **Color:** light theme by default. Warm off-white background (not pure white, not slate-50), near-black ink, one accent that is *not* violet/indigo — a deep terracotta or forest green as the house accent, with organizer-overridable accent per event. Dark mode as a proper second palette, not inverted.
- **Surfaces:** flat cards with 1px hairline borders and subtle grain/paper texture on hero areas; no glassmorphism, no glow, no gradient buttons, no neon blur blobs.
- **Radius & density:** medium radius (10–12px), consistent 4px grid, tighter than shadcn defaults in the dashboard, looser on public pages.
- **Motion:** purposeful only — modal open, ticket "issued" confirmation, check-in success. No scroll-triggered animation on marketing pages.
- **Event page anatomy:** cover image with color-extracted backdrop; date block + title + host row; register card sticky on desktop; about / venue map / sponsors strip / hosts / share; sponsor logos shown monochrome by default with color on hover.
- **Ticket:** designed as an object — a ticket card with perforated edge, QR, event date block, attendee name; looks good as a screenshot and in a wallet-style view.
- **Discovery:** magazine-like grid with strong image hierarchy, city and tag chips, calendar strip at top.
- **Theme implementation:** shadcn tokens redefined in `globals.css` (`--background`, `--foreground`, `--primary`, `--radius`, custom `--accent-event`, `--paper`), component variants extended rather than replaced, and a documented design-tokens file so self-hosters can rebrand in one place.

Design deliverables before build: token sheet, event page, registration modal, ticket, organizer dashboard, discovery grid — light and dark.

## 10. Success metrics

| Metric | Target (6 months post-launch) |
|---|---|
| Time from sign-up to published event | < 5 min median |
| Registration completion rate (page → ticket) | > 60% free, > 35% paid |
| GitHub stars / self-hosted instances reporting in (opt-in telemetry) | 3k / 300 |
| Cloud GMV on paid tickets | tracked; fee revenue = 0.99% × GMV |
| SMS unlock attach rate on free events | > 10% |
| Email/SMS delivery rate | > 98% / > 95% |
| API/MCP share of created events | > 10% |

## 11. Milestones

**M0 — Foundation (weeks 1–3):** monorepo, DB schema, auth, orgs, theme tokens, shadcn setup, design system pages.

**M1 — Free events (weeks 4–7):** event CRUD with all fields (venue, tags, social, cover, logo, sponsors), visibility modes, registration with custom fields + conditionals, email confirmations, tickets with QR, check-in, organizer dashboard. Self-hosted Docker image. _Internal launch._

**M2 — Paid events (weeks 8–11):** ticket types, Stripe Payment Element, Connect Standard/Express, 0.99% fee logic, refunds, discount codes, receipts. SMS via Vonage with the free/paid gate and $5 unlock.

**M3 — Discovery & API (weeks 12–14):** public discover page, SEO, sitemaps, REST API + OpenAPI + SDK, webhooks, MCP server. _Public beta of Cloud + open-source repo goes public._

**M4 — Polish & fast follows (weeks 15+):** approvals, waitlist, event templates, embeddable widget, Portuguese locale, one-click deploys.

## 12. Open questions

1. **License:** MIT (max adoption) vs AGPL (protects Cloud from hosted forks). Recommendation: AGPL for the app, MIT for SDK/MCP packages.
2. **Name and domain.**
3. **"Bring your own Stripe" on Cloud** = Connect Standard OAuth (fee collected automatically) rather than raw keys. Raw keys on Cloud would make the 0.99% uncollectable without invoicing. Confirm this is acceptable messaging ("connect your Stripe account").
4. **SMS fair-use limits** for "unlimited": proposed 5 messages per attendee per event; cap on international destinations with high per-message cost (e.g. block or surcharge countries above $0.10/msg).
5. **Minimum fee:** is 0.99% only, with no fixed component, viable on a $3 ticket ($0.03)? Consider a $0.10 floor or accept as loss-leader.
6. **Free-event SMS unlock:** $5 per event vs $5/month per org.
7. **Discovery moderation:** manual review queue for the first N events per new org, or automated only.
8. **Stripe Tax** in v1 or v2.
9. **Telemetry** from self-hosted instances: opt-in ping with instance count and version only.
10. **Custom domains** on Cloud: free or paid add-on.
