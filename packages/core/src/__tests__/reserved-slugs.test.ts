import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_ORGANIZATION_SLUGS } from "../services/orgs";

/**
 * Public event pages live at /{organizationSlug}/{eventSlug}. Static route segments always win
 * in the App Router, so a top-level route that isn't reserved would silently swallow every
 * event page of an organization with that slug. This walks apps/web/app so the list can't drift.
 */
describe("reserved organization slugs", () => {
  it("covers every top-level route directory in the web app", () => {
    const appDir = path.resolve(__dirname, "../../../../apps/web/app");
    const topLevel = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith("(") && entry.name.endsWith(")")) { walk(path.join(dir, entry.name)); continue; } // route group
        if (entry.name.startsWith("[")) continue; // dynamic
        topLevel.add(entry.name);
      }
    };
    walk(appDir);
    for (const segment of topLevel) expect(RESERVED_ORGANIZATION_SLUGS.has(segment), `route /${segment} must be a reserved organization slug`).toBe(true);
  });
});
