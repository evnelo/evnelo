import type { Database } from "@evnelo/db";

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Services accept either the pool-backed db or an open transaction. */
export type DbOrTx = Database | Tx;
