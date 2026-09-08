import { migrate } from "drizzle-orm/mysql2/migrator";
import { loadRootEnv } from "./env";
import { createDb } from "./index";

loadRootEnv();
const db = createDb();
await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
console.log("migrations applied");
process.exit(0);
