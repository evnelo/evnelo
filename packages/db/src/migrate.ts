import { migrate } from "drizzle-orm/mysql2/migrator";
import { createDb } from "./index";

const db = createDb();
await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
console.log("migrations applied");
process.exit(0);
