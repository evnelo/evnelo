import { defineConfig } from "drizzle-kit";
import { loadRootEnv } from "./src/env";

loadRootEnv();

export default defineConfig({
  dialect: "mysql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
