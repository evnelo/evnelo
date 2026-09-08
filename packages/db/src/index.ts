import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

export * from "./schema";
export type Database = ReturnType<typeof createDb>;

let pool: mysql.Pool | undefined;

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  pool ??= mysql.createPool({ uri: url, connectionLimit: 10, timezone: "Z" });
  return drizzle(pool, { schema, mode: "default" });
}
