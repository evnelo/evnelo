import { describe } from "vitest";

/**
 * Integration suites run against a real MySQL. Locally they skip when the database is unreachable
 * or not seeded, so `pnpm test` works anywhere. In CI (`CI=true`) the workflow provisions, migrates
 * and seeds the database, so a suite that cannot run means the pipeline is broken: fail loudly
 * rather than pass by skipping.
 */
export function describeIntegration(available: boolean, reason: string): typeof describe {
  if (available) return describe;
  if (process.env.CI) throw new Error(`Integration suite cannot run (${reason}). CI must provide a migrated, seeded MySQL at DATABASE_URL.`);
  return describe.skip as typeof describe;
}
