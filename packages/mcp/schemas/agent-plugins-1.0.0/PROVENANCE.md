# Frozen Agent Plugins 1.0.0 schemas

These files are unmodified copies of the official versioned JSON schemas, fetched on 2026-10-01 by the package milestone's evidence collection:

| File | Canonical source | SHA-256 |
| --- | --- | --- |
| `plugin.schema.json` | `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` | `314e540b787a9a19663f2656d6c7803b404b2656b6c776077a9b58fdbf2065d6` |
| `mcp.schema.json` | `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json` | `680ec8b411b8909e17023550b10ec0bd52220e3ddb35514f1bca70c8eb23d8e5` |

Upstream: `https://github.com/agentplugins/agent-plugins-spec`.
Upstream licensing notice: `https://raw.githubusercontent.com/agentplugins/agent-plugins-spec/main/LICENSE.md` assigns schemas and software material Apache-2.0; specification/documentation material is separately CC-BY-4.0. The accompanying `LICENSE.Apache-2.0.txt` is copied from upstream `LICENSES/Apache-2.0.txt`. No schema modifications have been made.

Ajv2020 compiles these local schemas with strict validation. No network fetch occurs in package checks, archive building or ordinary unit tests. Frozen schemas and this provenance/license material are development inputs, not ZIP members.

The portable schemas deliberately leave reverse-domain extension content unspecified. The validator therefore separately enforces the OpenAI listing/review constraints from the official plugin submission documentation snapshot (Manifest fields, listing metadata and review cases, lines 470–583 of the milestone's `submission.md` evidence). These include 30-character name/subtitle, 4000-character descriptions, 80-character developer name, 1024-character listing HTTPS URLs, three unique starter prompts of at most 128 characters, and exactly five positive/three negative review cases.

This is a deliberately narrow validator for the curated `evnelo-public` 0.1.0 package, not a general implementation of all optional Agent Plugins/OpenAI features. It rejects extra files, apps, lifecycle hooks, additional extension metadata, alternate endpoints/transports, authentication headers and credentials. It pins the unchanged existing Evnelo icon's bytes (square 64x64 SVG). Updating version, brand or package scope requires an explicit contract/test update. Secret-pattern checks are defensive checks for obvious assignments and key material, not a comprehensive secret-scanning guarantee.

Local checks establish package structure and deterministic bytes only. They do not establish publisher verification, commerce eligibility, installation success or public-review approval. Before submission the owner must review public-detail-page registration/purchase links against platform policy, supply a real accessible demo recording through the supported review workflow, verify the developer identity, and exercise actual package installation. No fabricated app identity or demo URL is packaged.
