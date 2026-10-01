# Public Evnelo plugin: draft packaging and release gates

This milestone packages the existing anonymous discovery integration. It does not add OAuth, private tools, publishing, attendee access, registration, ticket purchase, or checkout. No public plugin submission or publication has been performed.

## What has actually been verified

- Production `https://evnelo.com/mcp` initialized with a real SDK client, advertised only `search_public_events` and `render_event_cards`, and served the MCP Apps HTML resource.
- The owner tested populated cards in real ChatGPT with host CSP enforcement enabled and subsequently tested the rendered empty state. This is real-host evidence for the existing MCP connection, **not an installation test of a packaged plugin**.
- All four configured trusted web-origin candidates were accepted in direct initialize checks. This does not claim those hosts necessarily send those Origin headers.
- Private/unlisted/draft exclusion remains authoritative in the existing public API. This package cannot make organizer stdio capabilities available over HTTP.

## Package format and boundaries

Source tree: `plugins/evnelo-public/`.

```bash
pnpm --filter @evnelo/mcp plugin:check
pnpm --filter @evnelo/mcp plugin:package --out "$HOME/evnelo-public-0.1.0.zip"
```

The output must be a new absolute `.zip` path outside the repository with an existing parent directory. The CLI refuses overwriting an existing file or following a symlinked parent back into the repository. Ordinary package tests, schema checks and ZIP construction are offline.

The supported portable entry points are `plugin.json` and `mcp.json`, using the published Agent Plugins 1.0.0 schemas. OpenAI listing/review settings belong under `extensions.com.openai`; the reusable discovery workflow lives at `skills/discover-public-events/SKILL.md`. Branding reuses the existing `apps/web/app/icon.svg`, without redesign or a new brand identity.

The MCP configuration must contain one anonymous Streamable HTTP endpoint at `https://evnelo.com/mcp`: no Authorization headers, API keys, local commands, provider credentials or root environment file. The archive is a curated package, not a copy of the application repository. It must not contain symlinks, traversal paths, unexpected files, build dependencies or executable lifecycle hooks.

OpenAI's current public submission documentation rejects app references (`apps` / `.app.json`) and lifecycle hooks in submitted ZIPs. Do not invent or embed a `plugin_asdk_app` identifier. Declare the actual HTTPS server in `mcp.json` and complete the server setup in the submission dashboard. Local marketplace/registered-app flows are separate and may use different bindings; this milestone does not fabricate those bindings or claim their installation is verified.

## Workflow acceptance

The skill must respect explicit user instructions. For visual event browsing:

1. Search using supported public filters; clarify missing constraints when needed, rather than inventing a location.
2. Use authoritative results/IDs only. Never author card objects, forge event IDs or construct ticket/invite/order links.
3. Render up to 12 IDs from the same search page, with identical filters/pagination. Render an empty selection when the user wants the UI and no results match.
4. Honor text-only requests without forcing a widget. If an event disappears between search and render, re-search and explain the changed availability; do not bypass the server's fail-closed selection check.
5. Treat prices as discovery information, not checkout quotes or inventory guarantees. Public event-detail links do not grant permission to add registration or payment capabilities.

Package/backend checks can certify schemas, archive contents, endpoint wiring and HTTP results. They cannot certify model skill activation, user intent handling or the installed-package UI: rerun the packaged workflow in a clean real host.

## Owner gates before public review/publication

1. **Publishing identity and permissions:** choose the actual owning OpenAI organization/project and a verified individual/business identity with submission permissions. The initial metadata uses InEvent based on repository attribution; confirm it matches the identity you intend to publish under.
2. **Installed-package test:** import/install the actual ZIP through the supported host/dashboard path, not just the earlier standalone MCP connection. Run all five positive and three negative review prompts in clean chats, including populated, empty and unsupported/private requests. Inspect selected tools and actual UI. Separately test explicit text-only intent with “Find public events and give me text links only; do not show cards.” This additional manual check should invoke search without render; it is not one of the eight packaged review prompts.
3. **MCP scan and domain ownership:** connect the declared endpoint in the dashboard using no authentication, complete its domain-verification challenge, then inspect tool/resource/CSP findings. The dashboard currently asks for a plain-text token at `https://<challenge-base-host>/.well-known/openai-apps-challenge`. Do not invent a token, overwrite another plugin's challenge or assume this verification is already complete.
4. **Video walkthrough:** record the actual packaged workflow/review cases and provide a reviewer-accessible recording URL. No placeholder or fabricated video URL belongs in the manifest; the draft can omit this optional-in-ZIP field, but MCP review requires a recording before submission.
5. **Policy/privacy review:** verify the real website/support/privacy/terms URLs identify the publisher and accurately cover the MCP data flows. The current policy permits commerce only for physical goods and prohibits direct transactional links for unsupported commerce. This plugin is discovery-only; existing event-detail pages may expose registration/purchase actions, so their eligibility must be reviewed with the platform before public submission. A `commerce: false` declaration is not a policy exemption or proof that event-ticket commerce is approved.
6. **Automated findings and approval:** resolve package, skill and server findings, then request review. No public listing, publishing permission or approval is implied by a successful local build or ZIP upload.

## Sources checked October 1, 2026

- [Package your plugin](https://developers.openai.com/plugins/build/plugins)
- [Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission)
- [Build skills](https://developers.openai.com/plugins/build/skills)
- [Remote MCP server review requirements](https://developers.openai.com/plugins/deploy/app-review)
- [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
- [Agent Plugins manifest schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json)
- [Agent Plugins MCP schema](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json)

These requirements may change. Re-fetch the official documentation before upload/publication; local schema checks are not the submission portal's complete validation.
