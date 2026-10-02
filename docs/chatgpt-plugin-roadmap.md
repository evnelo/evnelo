# ChatGPT / MCP Apps integration roadmap

Status: public-only HTTP, inline cards and production Docker/Caddy wiring implemented, deployed by the owner and tested in real ChatGPT, 2026-10-01. Populated cards passed with host CSP enforcement enabled, and the empty-state widget rendered. A validated portable public plugin package is now available under `plugins/evnelo-public/`; **there is no published or installed full plugin yet**. The full-experience program is now approved and starts with delegated OAuth authority; no private HTTP capabilities are enabled yet. OAuth remains required before any private data or organizer mutation.

## Canonical full-experience delivery tracker

This document is the canonical program tracker. Update its detailed queue, state rollups and resume marker on every transition. A broad approval authorizes sequential production flows, not anonymous private access or automatic live deployment.

**Depth:** complete, locally certified user flows—not mock templates. **Scope:** linked account/organization authorization; organizer event/ticket-type management and confirmed publishing; account-bound free registration; attendee-owned ticket retrieval; scoped organizer reports; updated package and host evaluation. Paid checkout remains policy-gated. Existing web functionality is not proof the delegated MCP path is safe.

State legend: `[x]` implemented/verified · `[>]` active · `[ ]` pending · `[!]` external gate. Each item separately records source/push/deploy/enable status; a local commit is not live activation.

| Item | State / delivery evidence | Completion condition |
| --- | --- | --- |
| F0 Public discovery + card connection | `[x]` deployed by owner; real ChatGPT populated cards with CSP on and empty widget verified | Anonymous public-only search/render remain compatible. |
| P0 Public draft packaging | `[x]` verified commit `ab8908e`, now included in the pushed `feat/mcp-full-experience` checkpoint; not published/installed | Curated ZIP, offline schemas, deterministic build, live SDK-from-ZIP checks and independent review passed. Public release owner gates remain in `public-plugin-release.md`. |
| F1A Delegated-authority storage and token engine | `[>]` review blockers fixed with deterministic DB regressions; parent reran 194 core tests including 63 OAuth cases and all forced typechecks; fresh Node22/image and two-review certification pending; no private endpoints enabled | Additive migration on disposable MySQL; public-client/subject/resource/scopes and optional org bindings; S256 single-use codes, hashed access/refresh families, atomic rotation/reuse revocation; fresh user/org/role checks; adversarial/race/erasure tests. No API-key masquerading or mutations. |
| F1B OAuth protocol and MCP wire boundary | `[ ]` after F1A | Discovery, issuer response identification, exact redirects/resource, bounded client registration/trusted metadata policy, token/revoke routes, tested SDK descriptor adapter/challenges and one read-only identity proof. Advertise only implemented capabilities. |
| F1C Existing sign-in + explicit consent | `[ ]` after F1B; translation permission `[!]` unconfirmed | Browser session-bound/CSRF-protected consent, client/redirect identity, precise scopes and explicit optional org selection. Reuse Auth.js; no mutable `ev_org` grant authority. Legitimate attendees with no memberships can link. New static copy translated by approved pipeline; no external translation call until approved. |
| F1D Complete OAuth certification | `[ ]` after F1A–C | Real browser + SDK + Node22 + Docker/Caddy positive login/link/refresh/revoke and cross-user/org, expiry, replay, concurrency tests; exact-snapshot independent security/implementation reviews. Private surface default-disabled; owner-controlled deployment/activation. |
| F2 Organizer event management | `[ ]` after F1D | Delegated reads, create/edit drafts, ticket types/registration settings, preview and explicit approval for publishing/cancelling; per-request scope intersected with current `can()` and bound org; atomic idempotent replay and concurrency tests. No broad write key forwarded to `/api/v1`. |
| F3 Account-bound free registration | `[ ]` after F2 | Documented authoritative registration form/details; OAuth subject supplies ownership, not model email; preserve fields/approval/inventory/quotas/CAPTCHA/invite/offer/discount rules; one transaction and safe uncertain-result retries; real registration-to-order/ticket proof. Paid/checkout not enabled. |
| F4 Attendee-owned tickets | `[ ]` after F3 | Own-order/own-ticket allowlisted DTOs and login-protected destinations/UI, buyer/attendee/guest boundaries, revoked/refunded denial; no bearer ticket/order/QR/wallet/payment secrets in model content. Historical guest ownership must use a separately approved explicit claim policy, not automatic email matching. |
| F5 Scoped organizer reports | `[ ]` after F4 | Read-only org/event stats using current grants/roles; richer traffic/email reports separated from basic registration/revenue API; no broad attendee export or cross-org data. |
| F6 Full package + host release certification | `[ ]` after F5 | Package advertises only verified enabled tools; actual ChatGPT and Claude auth/challenge/consent/confirmation/owned-ticket flows; installed-package and policy/privacy review; owner signs off exact commit/migrations/config. Public publication remains separate. |
| F7 Paid ticket checkout | `[!]` platform eligibility / owner decision | Confirm current host commerce eligibility before implementing agent purchasing; preserve first-party payment credentials and transaction/refund authority. Technical MCP support is not approval. |
| F8 Optional share artwork / broader operations | `[ ]` after core full experience | Separate approved slices for public posters, invitations, check-in, messaging/exports/refunds; preserve private credential and per-role boundaries. Not silently included in the initial core release. |

**Resume here → F1A: certify the fixed candidate with fresh Node22/image checks and two matching exact-snapshot PASS reviews before commit/push and F1B.** F1 is not complete until protocol, consent and deployed-shape certification pass; do not describe token-engine tests alone as working host OAuth.

### Frozen boundaries and prerequisites

- Keep the production anonymous `/mcp` lane and organizer stdio source unchanged until a separately tested activation boundary exists. Public calls must remain credential-free and must never expand visibility after login.
- Use Auth.js users plus fresh database authority. JWT browser sessions and provider OAuth accounts are not MCP authorization grants; organization API-key scopes do not enforce the linked user's role.
- Installed SDK `1.30.0` targets an older protocol revision than the current 2026-07-28 MCP authorization guidance. It drops top-level tool `securitySchemes` in ordinary registration; a small tested wire adapter is required. Do not announce latest-spec compliance or upgrade the whole SDK/Zod convention without evidence.
- OpenAI documents tool-level challenges; Claude documents standard transport 401/WWW-Authenticate enforcement. Mixed single-connection behavior is a real-host acceptance gate, not an assumption.
- Native/public test client pre-registration can seed local proof. Choose and test trusted CIMD/DCR policy before network exposure; no arbitrary URL fetch or wildcard redirect. DCR is compatibility support in current guidance.
- New consent UI localization is an external-provider gate. The permission prompt was cancelled without an answer, so **no Google Translation call is authorized**. Backend work can proceed; do not fabricate target-language translations or call consent complete.
- All implementation remains on a feature branch. `master` CI promotes `production`, so a master push may deploy. No live OAuth activation or real email/payment/provider calls are implied by this program approval.
- Local safety: dedicated disposable MySQL fixture, known dummy AUTH_SECRET, provider-disabled processes; never print/change root `.env`, repurpose real API/provider keys, stop other projects or overwrite user artifacts.
- Account deletion cleanup has bounded rows/queries/batches and a time-based admission budget; it does not cancel an in-flight SQL/pool/network wait or certify a hard wall-clock deadline. Remaining material has explicit resume state. Background scheduling and transport/DB timeout policy are still pending integration gates.

## Implemented now

- Separate `packages/mcp/src/http-server.ts` entrypoint: `pnpm --filter @evnelo/mcp start:http`, loopback `127.0.0.1:3001/mcp` by default. The existing `start` / `src/server.ts` organizer stdio entrypoint and its tool contract remain unchanged.
- Official SDK Streamable HTTP, stateless JSON responses; a fresh MCP server/transport per POST, closed with the response. No user sessions or organizer clients shared between requests.
- Exactly two anonymous, read-only HTTP tools: data-first `search_public_events`, and `render_event_cards`. Both have explicit input/output schemas and read-only, non-destructive, idempotent, open-world annotations. Search is useful without a UI.
- Both tools exclusively use the existing generated SDK's `/public/events` REST route, with **no API key**, regardless of `EVNELO_API_KEY` or incoming Authorization. Existing API visibility permissions and public rate limits remain authoritative. No API expansion or SDK regeneration was needed.
- Render accepts `{ search, eventIds }`, not card objects. It re-fetches the exact public search page, allows at most 12 selected IDs, de-duplicates them, and fails the whole selection closed if an ID is absent. Public events that became private, unlisted, draft, deleted, ended, or no longer match that page cannot be retrieved by manipulating render IDs. Re-run search when this occurs; arbitrary ID lookup is intentionally not implemented.
- Registered versioned resource `ui://evnelo/public-event-cards/v1.html`, MIME `text/html;profile=mcp-app`; only render has `_meta.ui.resourceUri`.
- Self-contained HTML/CSS/JavaScript: production builds immutable JavaScript/catalogues into the dedicated MCP image; first resource read binds only the validated external canonical origin and hashes the final script/style CSP. Development can still bundle from sources. Runtime production needs no esbuild or web source/catalogue files. Uses the official MCP Apps `App` bridge for initial tool results, context changes and `openLink`; no invented `window.openai` API, dashboard embed, CDN, image load, direct browser API access or nested iframe.
- Responsive, keyboard-accessible cards show live names, organizer, start/end dates in each event's IANA time zone, format/venue/city and discovery prices. “View event” uses the host's link-opening capability and an authoritative canonical instance URL. These are discovery prices, not checkout quotes or inventory guarantees.
- Empty, error, loading, cancellation and rejected-link states. Text uses DOM `textContent`, not untrusted HTML. Links are restricted to the configured instance's canonical two-segment event paths without credentials, query or fragment.
- Reuses selected keys from the existing `common`, `public`, `emails` catalogues for all 20 languages; the existing locale negotiation and RTL rules are reused. English sources and generated translation targets are unchanged; no Google Translation calls are required. Bridge locale drives labels and date/currency formatting. Light/dark host theme and reduced-motion preferences are respected. Native-language UX review remains outstanding, as for the existing catalogues.
- Host allowlist (default exact localhost/127.0.0.1 plus listener port), exact Origin allowlist (none by default), no wildcard CORS, POST-only endpoint, JSON-only bodies capped at 64 KiB including chunked bodies, request/header/socket timeouts and 32 active-request ceiling. API calls have a five-second deadline and refuse redirects. `EVNELO_URL` must be an HTTPS origin, or loopback HTTP, with no credentials/path/query/fragment; it is operator-configured, never tool input. Optional `EVNELO_API_URL` validates independently as an HTTP(S) origin and permits operator-configured internal DNS. Upstream origin never appears in tool/card outputs. A global per-process 600-request/minute ceiling also protects MCP metadata, with `429` and `Retry-After`. JSON-RPC array/batch bodies are rejected before dispatch. Disconnect cancellation reaches discovery, and a separate shared 32-operation work guard retains capacity through SDK body consumption and schema validation, independently of transport close.

## Running and verifying locally

Keep the web app running and seed demo events; the MCP process does not load root `.env`:

```bash
EVNELO_URL=http://localhost:3000 pnpm --filter @evnelo/mcp start:http
# In another terminal (seeded demo instance required for live assertions):
MCP_LIVE_URL=http://localhost:3000 pnpm --filter @evnelo/mcp test
MCP_EVIDENCE_DIR=/absolute/path/outside/repo pnpm --filter @evnelo/mcp test:browser
pnpm --filter @evnelo/mcp typecheck
```

`MCP_PORT` overrides 3001. `MCP_ALLOWED_HOSTS` is a comma-separated list of exact Host header values (including the externally visible port if any), replacing loopback defaults. `MCP_ALLOWED_ORIGINS` is a comma-separated list of exact Origin values; absent Origin is allowed, present Origin is denied unless explicitly listed. `MCP_BIND` defaults to loopback and accepts only literal IP addresses; non-loopback binding requires an HTTPS canonical origin and defaults to its exact Host. These controls are not user authorization or distributed edge/DDoS protection. Production Caddy preserves approved Host, strips Authorization/Cookie, caps request bodies, bounds upstream waits and disables response buffering on exactly `/mcp`.

Default `pnpm --filter @evnelo/mcp test` runs transport/security/stdio tests without requiring the web server and skips two live search/render tests. `MCP_LIVE_URL` enables those tests and public search assertions in the HTTP/stdio entrypoint tests. Live tests expect seeded demo data. Tests start and stop their own local HTTP listeners, including dynamically allocated CLI smoke ports; existing local daemons can remain running.

Browser verification serves the **actual HTML read by a real SDK client from the HTTP MCP resource** in a deterministic official MCP Apps `AppBridge` host harness. It checks 390px/1280px layouts, canonical link opening, empty/error states, page errors, overflow, host dark theme and English/Portuguese/Chinese/Arabic/Spanish locale changes. External browser requests are blocked. This harness is explicitly **not ChatGPT**. Install Playwright Chromium (`pnpm --filter @evnelo/mcp exec playwright install chromium`) or set `MCP_CHROMIUM_PATH` to an existing executable. `MCP_EVIDENCE_DIR` stores HTML, SDK transcript, JSON assertions and screenshots; absent it, an OS temporary directory is used. Optional `MCP_HIDDEN_EVENT_IDS` supplies comma-separated known hidden fixture IDs for additional fail-closed live checks.

RED→GREEN evidence is maintained outside the repository. Verification includes actual package tests and all workspace typechecks; core integration suites must run serially against the isolated local DB to avoid their existing check-in/listing race. Turbo test-cache hits do not count as fresh DB evidence.

## Deployable production wiring and first ChatGPT test

- `packages/mcp/Dockerfile` is a narrow, non-root image with exactly the public server bundle, prebuilt cards and an initialize-POST healthcheck. No organizer entrypoint, provider/DB/API credentials, workspace package installation or runtime source tree. The Node base image still includes npm/yarn, but the service requires neither at runtime. Compose gives it only the public `APP_URL` as `EVNELO_URL`, `http://app:3000` as `EVNELO_API_URL`, binding/port and optional exact Origin allowlist; no shared environment file and no published MCP port. Its filesystem is read-only, capabilities dropped, privileges cannot be escalated.
- Caddy forwards **exactly** `/mcp` without stripping the path; all other web routes and the existing `www` redirect are preserved. `deploy.sh` rebuilds both app and MCP with bounded health waiting, then force-recreates Caddy so changed bind-mounted configuration is actually loaded. Success requires Caddy readiness and a TLS-verified public HTTPS MCP initialize result; otherwise the script exits nonzero without announcing deployment. MySQL health waits for the TCP listener, not the temporary initialization socket server.
- Local acceptance used actual built web/MCP images, a disposable migrated and seeded MySQL database and the actual Caddy routing configuration with a local CA. A real SDK client verified initialization, exactly two tools, search/render, resource read, HTTPS canonical links, private/draft denial and HTTP/Origin/body/path guards. The served resource CSP/script was verified without runtime sources. No real provider calls or production deploy were made.
- After operator deployment, inspect `https://your-instance/mcp` with **Streamable HTTP**, then add that HTTPS URL in ChatGPT developer mode using **no authentication**. Confirm only `search_public_events` and `render_event_cards`. Try “Find upcoming public events in São Paulo,” then “Show cards for those events”; test both model-readable results and inline UI. Try unsupported private/publish requests as negative checks. Absent Origin is accepted; configure `MCP_ALLOWED_ORIGINS` only with exact origins actually required by your host. A browser GET `405` is expected.
- Cards can be tested now alongside tools, and draft portable packaging is available. Installed-package validation and public approval remain pending; richer invitation/ticket cards and sidebar/composer extensions come later. Public discovery does not imply OAuth/private capabilities or plugin review approval. See README's first-test checklist.

## Not implemented / release gates

- No OAuth, authenticated HTTP tools, private analytics, drafts, creation, publishing, registrations, attendee exports or ticket credentials. Never reuse the stdio organizer's environment key as hosted authorization.
- No sidebar/thread/global entrypoint claims, installed-full-plugin test, developer-mode tunnel, public review/submission or plugin publication. The dedicated MCP service is now deployed with a working public HTTPS endpoint, and the owner has tested its cards in real ChatGPT. That does not certify every host/device/locale, an installed package or directory approval.
- No paid or embedded checkout. Current OpenAI commerce eligibility must be re-verified before any ticket-selling workflow is proposed; event discovery links are not authorization to implement plugin checkout.
- No share-artwork generator, personal invitation links, wallet/ticket QR views or broad embedded dashboard.
- Distributed production edge/DDoS policy, operational failure logs/monitoring, independent package/policy review, native-language review and broader real-host accessibility/device tests remain release work. The single-service MCP rate ceiling covers metadata as well as tools; the existing REST limits remain authoritative for discovery.

## Supporting capability detail

The canonical queue and completion conditions above govern execution. The sections below retain architectural detail; they are not a second independent status tracker.

### 0. Package the verified public discovery integration

Package only the public HTTPS MCP endpoint, branding and a reusable search/card workflow using the current portable `plugin.json` / `mcp.json` format. Include no app-reference IDs, hooks, secrets or organizer server. Validate the curated archive and actual endpoint wiring, then test the installed package, not only the original MCP connection. Owner/platform gates include publisher/domain verification, a real video walkthrough, review prompts and commerce/privacy eligibility. See [`public-plugin-release.md`](public-plugin-release.md). Packaging does not require OAuth for the existing anonymous public tools.

### 1. OAuth and authorization, before private HTTP capabilities

Use an established OAuth 2.1 authorization server where possible. Implement protected-resource and authorization-server discovery, authorization-code flow with PKCE S256, exact allowed redirects, issuer identification, one-use state/codes, audience/resource binding, expiry and least-privilege scopes. Validate issuer, audience, expiry and scopes on **every request**. Choose CIMD/predefined clients/DCR deliberately based on current host support, with SSRF-safe metadata/JWKS fetching; do not accept arbitrary model URLs. Support secure refresh rotation, revocation/disconnect and permission-change enforcement. Tokens never go in tool content, UI resources, logs or `_meta`.

Bind tokens to a signed-in user and an explicitly authorized organization. Re-check current membership and `can(role, action)` inside the service/API boundary for every tool, independent of the current-org cookie or hidden UI controls. Cross-organization attempts must fail closed. Add anonymous vs OAuth tool policy metadata and runtime authentication challenges using supported SDK/host contracts; do not imply these are implemented now. Test expired/revoked tokens, invalid audience, removed membership, insufficient scope and concurrent accounts before exposing a private tool.

### 2. Organizer creation and publishing

After phase 1, add narrow draft creation/editing through the existing service/API and generated SDK. Durable idempotency keys must prevent retries from duplicating events. Validate time zone, schedule, slug, permissions and organization scope; preview before consequential publishing, require explicit confirmation and return the authoritative result. Do not add “broadcast” loops without a permissioned, idempotent service/API operation.

### 3. Public share artwork

Generate a public share poster from authoritative public event data only. Keep it distinct from invitations and ticket QR credentials; never place personal invite, order, ticket or bearer tokens in model-visible content or downloadable public artwork. Declare exact asset origins and evaluate privacy/caching.

### 4. Private organizer analytics

Expose bounded, read-only reports after OAuth + live org permissions. Distinguish `/events/{id}/stats` registration/revenue/check-in counts from richer first-party traffic, campaign and email analytics; add documented API surfaces only when needed and regenerate OpenAPI/SDK. Minimize attendee data, scope periods/results and test permission changes and cross-org access.

### 5. Attendee-owned tickets

Design separate ticket-owner authorization; organizer membership is not attendee ownership and possession of a ticket URL must not leak a credential to the model. Use a properly authenticated UI-only retrieval boundary for private QR/wallet data. Define revocation, cancellations, refunds, invitation access and ticket/organization ownership separately. This is not enabled by `_meta` hiding fields.

### 6. Real-host evaluation and release

Re-fetch official host, authentication, extension, UI, review and commerce documentation. Independently review security and schemas, test real ChatGPT desktop/mobile and other MCP Apps hosts, verify labels/accessibility/locales, validate TLS/proxy/package behavior and monitoring, then consider submission. A passing deterministic harness is not proof of ChatGPT installation or plugin approval.

## Authoritative references used

OpenAI's current plugin build guides (`mcp-server`, `chatgpt-ui`, `auth`, `extensions`) were retrieved on 2026-09-30. Bridge behavior is based on the official `@modelcontextprotocol/ext-apps` 1.7.5 source/types and official MCP SDK 1.30.0 Streamable HTTP implementation. Installed dependency versions and the lockfile are the implementation contract; re-verify current documentation before the next phase.
