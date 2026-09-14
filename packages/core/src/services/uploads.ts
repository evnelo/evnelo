import { asc, eq, inArray, lt } from "drizzle-orm";
import { registrationUploads, type Database } from "@evnelo/db";
import { newId } from "../ids";
import type { DbOrTx } from "./db";

export const STALE_UPLOAD_MS = 24 * 60 * 60_000;

/** The browser was handed an upload URL for this key; until a registration claims it, it is a candidate for the sweep. */
export async function trackRegistrationUpload(db: Database, upload: { eventId: string; key: string }) {
  await db.insert(registrationUploads).values({ id: newId(), eventId: upload.eventId, objectKey: upload.key });
}

/** A stored registration references these keys: they are no longer orphans. Returns how many rows were pending. */
export async function claimRegistrationUploads(db: DbOrTx, keys: string[]) {
  if (!keys.length) return 0;
  const [result] = await db.delete(registrationUploads).where(inArray(registrationUploads.objectKey, keys));
  return result.affectedRows;
}

/** Uploads nobody submitted within the window, oldest first, in batches the sweep can finish in one tick. */
export async function staleRegistrationUploads(db: Database, now = new Date(), olderThanMs = STALE_UPLOAD_MS, limit = 200) {
  return db.select({ id: registrationUploads.id, eventId: registrationUploads.eventId, objectKey: registrationUploads.objectKey })
    .from(registrationUploads)
    .where(lt(registrationUploads.createdAt, new Date(now.getTime() - olderThanMs)))
    .orderBy(asc(registrationUploads.createdAt))
    .limit(limit);
}

export async function forgetRegistrationUpload(db: Database, id: string) {
  await db.delete(registrationUploads).where(eq(registrationUploads.id, id));
}
