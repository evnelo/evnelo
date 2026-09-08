import { fileURLToPath } from "node:url";

/**
 * Load the repo-root .env for CLI entry points (migrate, seed, drizzle-kit).
 * Variables already present in the environment win; a missing file is fine.
 */
export function loadRootEnv() {
  try {
    process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
  } catch {
    /* no root .env */
  }
}
