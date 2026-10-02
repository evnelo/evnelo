import { and, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { oauthGrants, oauthFamilies, oauthTokens, users, type Database } from "@evnelo/db";

/** Explicit privacy projection: never add token/code/challenge/session digests here. */
export const oauthAuthorityProjection = {
  id: oauthGrants.id, userId: oauthGrants.userId, clientId: oauthGrants.clientId,
  organizationId: oauthGrants.organizationId, scopes: oauthGrants.scopes,
  approvedAt: oauthGrants.approvedAt, revokedAt: oauthGrants.revokedAt, createdAt: oauthGrants.createdAt,
};

/** Trusted data-subject export with keyset pagination; no bearer or consent credential data. */
export async function exportOAuthAuthority(db: Database, userId: string, options: { after?: string; limit?: number } = {}) {
  const limit = options.limit ?? 100;
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(userId) || !Number.isSafeInteger(limit) || limit < 1 || limit > 500 || (options.after !== undefined && !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(options.after))) throw new Error("Invalid OAuth export page");
  const rows = await db.select(oauthAuthorityProjection).from(oauthGrants)
    .where(and(eq(oauthGrants.userId, userId), options.after ? gt(oauthGrants.id, options.after) : undefined)).orderBy(oauthGrants.id).limit(limit + 1);
  return { grants: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]!.id : null };
}

/** Erasure is only allowed after account deletion. One transaction deletes at most
 * limit tokens, or 2*limit family/grant rows; retained rows are restart metadata. */
export async function eraseOAuthUserBatch(db: Database, userId: string, limit = 100) {
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(userId) || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("Invalid OAuth erasure batch");
  return db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    if (user) throw new Error("Delete account before erasing OAuth authority");
    // Use the subject index only to locate IDs. Lock primary rows in the same order
    // as purge/revocation; holding a secondary-index lock while waiting for a primary
    // row can otherwise deadlock with a purge deleting that row's index entries.
    const hints = await tx.select({ id: oauthGrants.id }).from(oauthGrants).where(eq(oauthGrants.userId, userId)).limit(limit);
    if (!hints.length) return { deleted: 0, hasMore: false };
    const rows = await tx.select({ id: oauthGrants.id, userId: oauthGrants.userId }).from(oauthGrants)
      .where(inArray(oauthGrants.id, hints.map((g) => g.id))).orderBy(oauthGrants.id).for("update");
    const grants = rows.filter((g) => g.userId === userId);
    if (!grants.length) return { deleted: 0, hasMore: true };
    const grantIds = grants.map((g) => g.id);
    const familyHints = await tx.select({ id: oauthFamilies.id }).from(oauthFamilies).where(inArray(oauthFamilies.grantId, grantIds)).limit(limit);
    const familyRows = familyHints.length ? await tx.select({ id: oauthFamilies.id, grantId: oauthFamilies.grantId }).from(oauthFamilies)
      .where(inArray(oauthFamilies.id, familyHints.map((f) => f.id))).orderBy(oauthFamilies.id).for("update") : [];
    const families = familyRows.filter((f) => grantIds.includes(f.grantId));
    const familyIds = families.map((f) => f.id);
    const tokens = familyIds.length ? await tx.select({ id: oauthTokens.id }).from(oauthTokens).where(inArray(oauthTokens.familyId, familyIds)).limit(limit).for("update") : [];
    if (tokens.length) {
      await tx.delete(oauthTokens).where(inArray(oauthTokens.id, tokens.map((t) => t.id)));
      return { deleted: tokens.length, hasMore: true };
    }
    if (familyIds.length) await tx.delete(oauthFamilies).where(inArray(oauthFamilies.id, familyIds));
    // If legacy/corrupt data has more than one family per grant, drain families before grants.
    const remainingFamilies = await tx.select({ id: oauthFamilies.id }).from(oauthFamilies).where(inArray(oauthFamilies.grantId, grantIds)).limit(1);
    if (!remainingFamilies.length) await tx.delete(oauthGrants).where(inArray(oauthGrants.id, grantIds));
    return { deleted: familyIds.length + (remainingFamilies.length ? 0 : grantIds.length), hasMore: true };
  });
}

/** Indexed housekeeping. Used refresh digests survive revocation until the bounded family lifetime ends. */
export async function purgeOAuth(db: Database, now = new Date(), limit = 100) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500 || !Number.isFinite(now.getTime())) throw new Error("Invalid OAuth cleanup batch");
  const familyBatch = await db.transaction(async (tx) => {
    const hints = await tx.select({ id: oauthFamilies.id }).from(oauthFamilies).where(lte(oauthFamilies.expiresAt, now)).limit(limit);
    const rows = hints.length ? await tx.select({ id: oauthFamilies.id, expiresAt: oauthFamilies.expiresAt }).from(oauthFamilies)
      .where(inArray(oauthFamilies.id, hints.map((f) => f.id))).orderBy(oauthFamilies.id).for("update") : [];
    const families = rows.filter((f) => f.expiresAt <= now);
    const familyIds = families.map((f) => f.id);
    const tokens = familyIds.length ? await tx.select({ id: oauthTokens.id }).from(oauthTokens).where(inArray(oauthTokens.familyId, familyIds)).limit(limit).for("update") : [];
    if (tokens.length) await tx.delete(oauthTokens).where(inArray(oauthTokens.id, tokens.map((t) => t.id)));
    let familiesDeleted = 0;
    if (familyIds.length) {
      const empty: string[] = [];
      // A locking outer anti-join does not make its nested token read current under
      // REPEATABLE READ. The family locks already exclude rotation; explicitly read
      // remaining tokens currently before deciding that a family is empty.
      for (const familyId of familyIds) {
        const remaining = await tx.select({ id: oauthTokens.id }).from(oauthTokens).where(eq(oauthTokens.familyId, familyId)).limit(1).for("share");
        if (!remaining.length) empty.push(familyId);
      }
      if (empty.length) await tx.delete(oauthFamilies).where(inArray(oauthFamilies.id, empty));
      familiesDeleted = empty.length;
    }
    return { tokensDeleted: tokens.length, familiesDeleted };
  });
  // Release family locks before acquiring grant locks: erasure locks grant -> family.
  // A crash between phases leaves only inert, eligible grant metadata for the next batch.
  const grantsDeleted = await db.transaction(async (tx) => {
    // The anti-join is a locator only. A locking anti-join may lock its family scan
    // before the grant row, reversing erasure's grant -> family order in InnoDB.
    const hints = await tx.select({ id: oauthGrants.id }).from(oauthGrants)
      .where(and(lte(oauthGrants.expiresAt, now), sql`NOT EXISTS (SELECT 1 FROM oauth_families WHERE oauth_families.grant_id = oauth_grants.id)`)).limit(limit);
    if (!hints.length) return 0;
    const grants = await tx.select({ id: oauthGrants.id, expiresAt: oauthGrants.expiresAt }).from(oauthGrants)
      .where(inArray(oauthGrants.id, hints.map((g) => g.id))).orderBy(oauthGrants.id).for("update");
    const empty: string[] = [];
    for (const grant of grants) {
      if (grant.expiresAt > now) continue;
      const families = await tx.select({ id: oauthFamilies.id }).from(oauthFamilies).where(eq(oauthFamilies.grantId, grant.id)).limit(1).for("share");
      if (!families.length) empty.push(grant.id);
    }
    if (empty.length) await tx.delete(oauthGrants).where(inArray(oauthGrants.id, empty));
    return empty.length;
  });
  return { ...familyBatch, grantsDeleted };
}

/** Auth.js deletion hook: account absence is immediate logical withdrawal (issuance holds
 * a current shared user lock). No all-grants UPDATE, and no unbounded outer drain loop.
 * At most three cleanup batches, each touching at most 2*limit material rows. The wall
 * deadline bounds admission of further batches, not an in-flight database statement.
 * Retained grants indexed by userId are durable restart metadata; resume explicitly with
 * eraseOAuthUserBatch or this function. No background scheduler is implied.
 */
export async function deleteOAuthUser(db: Database, userId: string, now = new Date(), options: { limit?: number; maxBatches?: number; maxDurationMs?: number } = {}) {
  const limit = options.limit ?? 100, maxBatches = options.maxBatches ?? 3, maxDurationMs = options.maxDurationMs ?? 1000;
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(userId) || !Number.isFinite(now.getTime()) || !Number.isSafeInteger(limit) || limit < 1 || limit > 500 || !Number.isSafeInteger(maxBatches) || maxBatches < 0 || maxBatches > 3 || !Number.isSafeInteger(maxDurationMs) || maxDurationMs < 0 || maxDurationMs > 10000) throw new Error("Invalid OAuth deletion budget");
  const deadline = Date.now() + maxDurationMs;
  await db.transaction(async (tx) => {
    await tx.delete(users).where(eq(users.id, userId));
  });
  let deleted = 0, batches = 0;
  while (batches < maxBatches && Date.now() < deadline) {
    const batch = await eraseOAuthUserBatch(db, userId, limit);
    batches++;
    deleted += batch.deleted;
    if (!batch.hasMore) break;
  }
  const remaining = await db.select({ id: oauthGrants.id }).from(oauthGrants).where(eq(oauthGrants.userId, userId)).limit(1);
  return { deleted, batches, hasMore: remaining.length > 0, resumeUserId: remaining.length ? userId : null };
}
