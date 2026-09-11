import { existsSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { env } from "./env";

/**
 * Apply pending migrations at process start (MIGRATE_ON_START=true, the Docker image default).
 * Uses its own connection so GET_LOCK/RELEASE_LOCK pair on one session: several replicas can
 * boot at once and only one runs the migrator while the others wait, then find nothing to do.
 */
export async function migrateOnStart() {
  if (env.MIGRATE_ON_START !== "true") return;
  const folder = migrationsFolder();
  const conn = await mysql.createConnection({ uri: env.DATABASE_URL, timezone: "Z", multipleStatements: true });
  try {
    const [rows] = await conn.query<mysql.RowDataPacket[]>("select get_lock('openticket_migrate', 120) as locked");
    if (rows[0]?.locked !== 1) throw new Error("Could not acquire the migration lock within 120s.");
    try {
      await migrate(drizzle(conn), { migrationsFolder: folder });
      console.log(`[migrate] up to date (${path.relative(process.cwd(), folder)})`);
    } finally {
      await conn.query("select release_lock('openticket_migrate')");
    }
  } finally {
    await conn.end();
  }
}

/** Dev runs from apps/web; the standalone image copies packages/db/drizzle next to the app. */
function migrationsFolder() {
  const candidates = [env.DB_MIGRATIONS_DIR, path.resolve(process.cwd(), "../../packages/db/drizzle"), path.resolve(process.cwd(), "packages/db/drizzle")].filter((c): c is string => !!c);
  const found = candidates.find((c) => existsSync(path.join(c, "meta", "_journal.json")));
  if (!found) throw new Error(`Migrations folder not found (looked in ${candidates.join(", ")}); set DB_MIGRATIONS_DIR.`);
  return found;
}
