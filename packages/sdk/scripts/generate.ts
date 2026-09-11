/**
 * Regenerate the SDK types from the OpenAPI document the web app serves at /api/v1/openapi.json.
 * Reads the TypeScript source directly (no server needed), writes openapi.json for reference and
 * src/schema.d.ts for openapi-fetch. Run: pnpm --filter @evnelo/sdk generate
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";
import { openApiDocument } from "../../../apps/web/lib/openapi";

const here = path.dirname(fileURLToPath(import.meta.url));
const json = JSON.stringify(openApiDocument, null, 2);
await writeFile(path.join(here, "../openapi.json"), `${json}\n`);

// defaultNonNullable off: a property with a default stays optional on input, as the zod schemas treat it
const ast = await openapiTS(JSON.parse(json), { alphabetize: false, defaultNonNullable: false });
const header = "// Generated from apps/web/lib/openapi.ts by `pnpm --filter @evnelo/sdk generate`. Do not edit by hand.\n\n";
await writeFile(path.join(here, "../src/schema.d.ts"), header + astToString(ast));
console.log(`Wrote openapi.json and src/schema.d.ts (${Object.keys(openApiDocument.paths).length} paths).`);
