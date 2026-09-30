# ChatGPT / MCP Apps integration roadmap

Status: first public-only local slice implemented, 2026-09-30. This is a working MCP Apps integration, **not a released or ChatGPT-installed plugin**. OAuth is the next gate, before any hosted private data or organizer mutation is exposed.

## Implemented now

- Separate `packages/mcp/src/http-server.ts` entrypoint: `pnpm --filter @evnelo/mcp start:http`, loopback `127.0.0.1:3001/mcp` by default. The existing `start` / `src/server.ts` organizer stdio entrypoint and its tool contract remain unchanged.
- Official SDK Streamable HTTP, stateless JSON responses; a fresh MCP server/transport per POST, closed with the response. No user sessions or organizer clients shared between requests.
- Exactly two anonymous, read-only HTTP tools: data-first `search_public_events`, and `render_event_cards`. Both have explicit input/output schemas and read-only, non-destructive, idempotent, open-world annotations. Search is useful without a UI.
- Both tools exclusively use the existing generated SDK's `/public/events` REST route, with **no API key**, regardless of `EVNELO_API_KEY` or incoming Authorization. Existing API visibility permissions and public rate limits remain authoritative. No API expansion or SDK regeneration was needed.
- Render accepts `{ search, eventIds }`, not card objects. It re-fetches the exact public search page, allows at most 12 selected IDs, de-duplicates them, and fails the whole selection closed if an ID is absent. Public events that became private, unlisted, draft, deleted, ended, or no longer match that page cannot be retrieved by manipulating render IDs. Re-run search when this occurs; arbitrary ID lookup is intentionally not implemented.
- Registered versioned resource `ui://evnelo/public-event-cards/v1.html`, MIME `text/html;profile=mcp-app`; only render has `_meta.ui.resourceUri`.
- Self-contained HTML/CSS/JavaScript bundle generated once per configured instance on the first resource read. Uses the official MCP Apps `App` bridge for initial tool results, context changes and `openLink`; no invented `window.openai` API, dashboard embed, CDN, image load, direct browser API access or nested iframe.
- Responsive, keyboard-accessible cards show live names, organizer, start/end dates in each event's IANA time zone, format/venue/city and discovery prices. “View event” uses the host's link-opening capability and an authoritative canonical instance URL. These are discovery prices, not checkout quotes or inventory guarantees.
- Empty, error, loading, cancellation and rejected-link states. Text uses DOM `textContent`, not untrusted HTML. Links are restricted to the configured instance's canonical two-segment event paths without credentials, query or fragment.
- Reuses selected keys from the existing `common`, `public`, `emails` catalogues for all 20 languages; the existing locale negotiation and RTL rules are reused. English sources and generated translation targets are unchanged; no Google Translation calls are required. Bridge locale drives labels and date/currency formatting. Light/dark host theme and reduced-motion preferences are respected. Native-language UX review remains outstanding, as for the existing catalogues.
- Host allowlist (default exact localhost/127.0.0.1 plus listener port), exact Origin allowlist (none by default), no wildcard CORS, POST-only endpoint, JSON-only bodies capped at 64 KiB including chunked bodies, request/header/socket timeouts and 32 active-request ceiling. API calls have a five-second deadline and refuse redirects. `EVNELO_URL` must be an HTTPS origin, or loopback HTTP, with no credentials/path/query/fragment; it is operator-configured, never tool input.

## Running and verifying locally

Keep the web app running and seed demo events; the MCP process does not load root `.env`:

```bash
EVNELO_URL=http://localhost:3000 pnpm --filter @evnelo/mcp start:http
# In another terminal (seeded demo instance required for live assertions):
MCP_LIVE_URL=http://localhost:3000 pnpm --filter @evnelo/mcp test
MCP_EVIDENCE_DIR=/absolute/path/outside/repo pnpm --filter @evnelo/mcp test:browser
pnpm --filter @evnelo/mcp typecheck
```

`MCP_PORT` overrides 3001. `MCP_ALLOWED_HOSTS` is a comma-separated list of exact Host header values (including the externally visible port if any), replacing loopback defaults. `MCP_ALLOWED_ORIGINS` is a comma-separated list of exact Origin values; absent Origin is allowed, present Origin is denied unless explicitly listed. These controls are not user authorization or production edge abuse protection. A future HTTPS reverse proxy must preserve the approved Host, limit requests, and never forward organizer credentials.

Default `pnpm --filter @evnelo/mcp test` runs transport/security/stdio tests without requiring the web server and skips two live search/render tests. `MCP_LIVE_URL` enables those tests and public search assertions in the HTTP/stdio entrypoint tests. Live tests expect seeded demo data. Tests start and stop their own local HTTP listeners (CLI smoke uses port 3001); do not leave a separate HTTP MCP process on 3001 when running them.

Browser verification serves the **actual HTML read by a real SDK client from the HTTP MCP resource** in a deterministic official MCP Apps `AppBridge` host harness. It checks 390px/1280px layouts, canonical link opening, empty/error states, page errors, overflow, host dark theme and English/Portuguese/Chinese/Arabic/Spanish locale changes. External browser requests are blocked. This harness is explicitly **not ChatGPT**. Install Playwright Chromium (`pnpm --filter @evnelo/mcp exec playwright install chromium`) or set `MCP_CHROMIUM_PATH` to an existing executable. `MCP_EVIDENCE_DIR` stores HTML, SDK transcript, JSON assertions and screenshots; absent it, an OS temporary directory is used. Optional `MCP_HIDDEN_EVENT_IDS` supplies comma-separated known hidden fixture IDs for additional fail-closed live checks.

RED→GREEN evidence is maintained outside the repository. Verification includes actual package tests and all workspace typechecks; core integration suites must run serially against the isolated local DB to avoid their existing check-in/listing race. Turbo test-cache hits do not count as fresh DB evidence.

## Not implemented / release gates

- No OAuth, authenticated HTTP tools, private analytics, drafts, creation, publishing, registrations, attendee exports or ticket credentials. Never reuse the stdio organizer's environment key as hosted authorization.
- No sidebar/thread/global entrypoint claims, real ChatGPT installation test, developer-mode tunnel, review/submission, production HTTPS endpoint or deployment. The web Docker image does not package this separate MCP service.
- No paid or embedded checkout. Current OpenAI commerce eligibility must be re-verified before any ticket-selling workflow is proposed; event discovery links are not authorization to implement plugin checkout.
- No share-artwork generator, personal invitation links, wallet/ticket QR views or broad embedded dashboard.
- Production edge rate limits, TLS/proxy configuration, packaging the pre-built UI rather than runtime bundling, operational logs/monitoring, source review, native-language review and real-host accessibility/device tests remain release work. Existing REST rate limits do not protect every MCP metadata request.

## Ordered next phases

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
