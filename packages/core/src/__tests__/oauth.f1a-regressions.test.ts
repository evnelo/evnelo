import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { appendFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/mysql2";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@evnelo/db";
import type { Database } from "@evnelo/db";
import { newId } from "../ids";
import { DelegatedOAuth } from "../services/oauth";
import { deleteOrganization } from "../services/privacy";
import { deleteOAuthUser, eraseOAuthUserBatch, purgeOAuth } from "../services/oauth-lifecycle";

const require = createRequire(new URL("../../../db/package.json", import.meta.url));
const mysql = require("mysql2/promise") as typeof import("../../../db/node_modules/mysql2/promise");
const url = process.env.MCP_OAUTH_TEST_DATABASE_URL;
if (url && (new URL(url).hostname !== "127.0.0.1" || new URL(url).port !== "3311" || new URL(url).pathname !== "/evnelo")) throw new Error("Owned fixture required");
const pool = url ? mysql.createPool({ uri: url, connectionLimit: 10, timezone: "Z" }) : null!;
const pool2 = url ? mysql.createPool({ uri: url, connectionLimit: 10, timezone: "Z" }) : null!;
let onQuery: ((query: string) => void) | undefined;
const db: Database = url ? drizzle(pool, { schema, mode: "default", logger: { logQuery(query) { onQuery?.(query); } } }) : null!;
const db2: Database = url ? drizzle(pool2, { schema, mode: "default" }) : null!;
const issuer = "http://localhost:3939", resource = `${issuer}/mcp`, redirectUri = "http://127.0.0.1:49391/callback";
const clientId = `f1a-fix-${newId()}`, userId = newId();
const ownedUsers = [userId], ownedOrganizations: string[] = [];
let internalClientId: string;
const actor = { userId, sessionNonce: "fix-regression-session-nonce-32-chars" };
const verifier = "a".repeat(43), codeChallenge = createHash("sha256").update(verifier).digest("base64url");
const base = new Date("2026-10-01T12:00:00Z");
let clock: () => Date = () => base;
const engine = new DelegatedOAuth({ issuer, resource, clock: () => clock(), refreshTtlMs: 1000 });
const input = { clientId, redirectUri, resource, scopes: ["mcp:profile:read" as const], codeChallenge, codeChallengeMethod: "S256" as const };
function evidence(value: Record<string, unknown>) {
  if (process.env.F1A_EVIDENCE_FILE) appendFileSync(process.env.F1A_EVIDENCE_FILE, `${JSON.stringify(value)}\n`);
}
async function approved() {
  const pending = await engine.beginAuthorization(db, actor, input);
  const { code } = await engine.approveAuthorization(db, actor, pending.id);
  return { code, id: pending.id };
}
async function issue() {
  const grant = await approved();
  return { ...await engine.exchangeCode(db, { clientId, redirectUri, resource, code: grant.code, codeVerifier: verifier }), grantId: grant.id };
}
(url ? describe : describe.skip)("F1A independent SQL regressions", () => {
  beforeAll(async () => {
    await db.insert(schema.users).values({ id: userId, email: `${userId}@fix.invalid` });
    internalClientId = (await engine.registerClient(db, { clientId, redirectUris: [redirectUri], scopes: ["mcp:profile:read", "mcp:org:read"], tokenEndpointAuthMethod: "none" })).id;
  });
  afterAll(async () => {
    onQuery = undefined;
    try {
      const grants = await db.select({ id: schema.oauthGrants.id }).from(schema.oauthGrants).where(eq(schema.oauthGrants.clientId, internalClientId));
      if (grants.length) {
        const families = await db.select({ id: schema.oauthFamilies.id }).from(schema.oauthFamilies).where(inArray(schema.oauthFamilies.grantId, grants.map((g) => g.id)));
        if (families.length) {
          await db.delete(schema.oauthTokens).where(inArray(schema.oauthTokens.familyId, families.map((f) => f.id)));
          await db.delete(schema.oauthFamilies).where(inArray(schema.oauthFamilies.id, families.map((f) => f.id)));
        }
        await db.delete(schema.oauthGrants).where(inArray(schema.oauthGrants.id, grants.map((g) => g.id)));
      }
      await db.delete(schema.oauthClients).where(eq(schema.oauthClients.id, internalClientId));
      if (ownedOrganizations.length) {
        await db.delete(schema.organizationMembers).where(inArray(schema.organizationMembers.organizationId, ownedOrganizations));
        await db.delete(schema.organizations).where(inArray(schema.organizations.id, ownedOrganizations));
      }
      await db.delete(schema.users).where(inArray(schema.users.id, ownedUsers));
      expect(await db2.select({ id: schema.oauthGrants.id }).from(schema.oauthGrants).where(eq(schema.oauthGrants.clientId, internalClientId))).toHaveLength(0);
      expect(await db2.select({ id: schema.users.id }).from(schema.users).where(inArray(schema.users.id, ownedUsers))).toHaveLength(0);
      evidence({ scenario: "scoped regression fixture cleanup", verified: true });
    } finally { await pool?.end(); await pool2?.end(); }
  });

  it("caps one wired account deletion of 305 grants and exposes durable resumable work", async () => {
    const id = newId();
    ownedUsers.push(id);
    await db.insert(schema.users).values({ id, email: `${id}@fix.invalid` });
    const subject = { ...actor, userId: id };
    const pending = await engine.beginAuthorization(db, subject, input);
    const { code } = await engine.approveAuthorization(db, subject, pending.id);
    const tokens = await engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier });
    const [template] = await db.select().from(schema.oauthGrants).where(eq(schema.oauthGrants.id, pending.id));
    await db.insert(schema.oauthGrants).values(Array.from({ length: 304 }, () => ({ ...template!, id: newId(), codeHash: null, codeUsedAt: null, approvedAt: null })));
    let transactions = 0, queries = 0;
    const counted = new Proxy(db, { get(target, key) {
      if (key === "transaction") return (...args: Parameters<Database["transaction"]>) => { transactions++; return target.transaction(...args); };
      return Reflect.get(target, key);
    } });
    onQuery = () => { queries++; };
    const result = await deleteOAuthUser(counted, id, base, { limit: 50, maxBatches: 2, maxDurationMs: 1000 });
    onQuery = undefined;
    expect(transactions).toBeLessThanOrEqual(3);
    // Includes BEGIN/COMMIT: 3 invalidation + 2*(9 data + 2 control) + 1 resumability read.
    expect(queries).toBeLessThanOrEqual(26);
    expect(result).toMatchObject({ hasMore: true, batches: 2, resumeUserId: id });
    expect(await db2.select().from(schema.users).where(eq(schema.users.id, id))).toHaveLength(0);
    const remaining = await db2.select({ id: schema.oauthGrants.id }).from(schema.oauthGrants).where(eq(schema.oauthGrants.userId, id));
    expect(remaining.length).toBeGreaterThanOrEqual(205);
    evidence({ scenario: "305 grants with two 50-row batches", transactions, queries, batches: result.batches, deleted: result.deleted, remaining: remaining.length, hasMore: result.hasMore });
    await expect(engine.validateAccess(db2, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:profile:read"] })).rejects.toThrow();
    const fresh = await engine.refresh(db2, { clientId, resource, refreshToken: tokens.refreshToken }).then(() => "fulfilled", (error) => error.code);
    expect(["access_denied", "invalid_grant"]).toContain(fresh);
    // A separate pool discovers retained material via the persisted subject index, not memory.
    let drained = false;
    for (let i = 0; i < 20; i++) {
      const batch = await eraseOAuthUserBatch(db2, id, 50);
      expect(batch.deleted).toBeLessThanOrEqual(100);
      if (!batch.hasMore) { drained = true; break; }
    }
    expect(drained).toBe(true);
    expect(await db2.select().from(schema.oauthGrants).where(eq(schema.oauthGrants.userId, id))).toHaveLength(0);
    const repeat = await deleteOAuthUser(db2, id, base, { limit: 50, maxBatches: 2, maxDurationMs: 1000 });
    expect(repeat.hasMore).toBe(false);
  });

  it("keeps the actual Auth.js adapter void return and bounds its default cleanup of 305 pending grants", async () => {
    const { drizzleAdapter } = await import("../../../../apps/web/lib/auth/adapter");
    const id = newId(); ownedUsers.push(id);
    await db.insert(schema.users).values({ id, email: `${id}@fix.invalid` });
    const pending = await engine.beginAuthorization(db, { ...actor, userId: id }, input);
    const [template] = await db.select().from(schema.oauthGrants).where(eq(schema.oauthGrants.id, pending.id));
    await db.insert(schema.oauthGrants).values(Array.from({ length: 304 }, () => ({ ...template!, id: newId() })));
    let transactions = 0;
    const counted = new Proxy(db, { get(target, key) {
      if (key === "transaction") return (...args: Parameters<Database["transaction"]>) => { transactions++; return target.transaction(...args); };
      return Reflect.get(target, key);
    } });
    expect(await drizzleAdapter(counted).deleteUser!(id)).toBeUndefined();
    expect(transactions).toBeLessThanOrEqual(4);
    const remaining = await db2.select({ id: schema.oauthGrants.id }).from(schema.oauthGrants).where(eq(schema.oauthGrants.userId, id));
    expect(remaining.length).toBeGreaterThanOrEqual(5);
    expect(await db2.select().from(schema.users).where(eq(schema.users.id, id))).toHaveLength(0);
    await expect(engine.approveAuthorization(db2, { ...actor, userId: id }, remaining[0]!.id)).rejects.toMatchObject({ code: "access_denied" });
    evidence({ scenario: "Auth.js default hook with 305 pending grants", transactions, remaining: remaining.length });
    expect((await deleteOAuthUser(db2, id)).hasMore).toBe(false);
  });

  it.each(["organization", "account", "membership", "role"] as const)("serializes %s withdrawal with a refresh blocked at the family lock", async (change) => {
    const id = newId(), org = newId();
    ownedUsers.push(id); ownedOrganizations.push(org);
    await db.insert(schema.users).values({ id, email: `${id}@fix.invalid` });
    await db.insert(schema.organizations).values({ id: org, name: "Fix race", slug: `fix-${org.toLowerCase()}` });
    await db.insert(schema.organizationMembers).values({ userId: id, organizationId: org, role: "owner" });
    const subject = { ...actor, userId: id };
    const pending = await engine.beginAuthorization(db, subject, { ...input, scopes: ["mcp:org:read"], organizationId: org });
    const { code } = await engine.approveAuthorization(db, subject, pending.id);
    const tokens = await engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier });
    const [family] = await db2.select().from(schema.oauthFamilies).where(eq(schema.oauthFamilies.grantId, pending.id));
    const blocker = await pool2.getConnection();
    await blocker.beginTransaction();
    await blocker.execute("SELECT id FROM oauth_families WHERE id=? FOR UPDATE", [family!.id]);
    let reached!: () => void;
    const atFamily = new Promise<void>((resolve) => { reached = resolve; });
    onQuery = (query) => { if (query.includes("oauth_families") && query.includes("for update")) reached(); };
    const order: string[] = [];
    const refreshing = engine.refresh(db, { clientId, resource, refreshToken: tokens.refreshToken }).then(() => "fulfilled", (error) => error.code);
    await atFamily;
    onQuery = (query) => { if (query.startsWith("insert into `oauth_tokens`")) order.push("mint"); };
    let withdrawn = false;
    const markWithdrawal = () => { if (!withdrawn) { withdrawn = true; order.push("withdrawal"); } };
    let deletionTransactions = 0;
    const deletionDb = new Proxy(db2, { get(target, key) {
      if (key === "transaction") return async (...args: Parameters<Database["transaction"]>) => {
        const first = ++deletionTransactions === 1;
        const result = await target.transaction(...args);
        if (first) markWithdrawal();
        return result;
      };
      return Reflect.get(target, key);
    } });
    const withdrawal = (change === "organization" ? deleteOrganization(db2, org, base)
      : change === "account" ? deleteOAuthUser(deletionDb, id, base)
      : change === "membership" ? db2.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, org))
      : db2.update(schema.organizationMembers).set({ role: "checkin" }).where(eq(schema.organizationMembers.organizationId, org)))
      .then(markWithdrawal, (error) => { throw error; });
    // Observe an actual server-side withdrawal statement, or its completed commit, before release.
    try {
      for (let i = 0; i < 200 && !withdrawn; i++) {
        const [rows] = await pool2.query("SHOW FULL PROCESSLIST");
        if ((rows as { Info?: string }[]).some((row) => row.Info && /(?:delete from `users`|from `organizations`.*for update|(?:delete from|update) `organization_members`)/i.test(row.Info))) break;
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (i === 199) throw new Error("Withdrawal was not observed at the server");
      }
    } finally { await blocker.commit(); blocker.release(); }
    const outcome = await refreshing;
    await withdrawal;
    onQuery = undefined;
    if (outcome === "fulfilled") expect(order).toEqual(["mint", "withdrawal"]);
    else expect(["access_denied", "invalid_grant"]).toContain(outcome);
    evidence({ scenario: `family-blocked ${change} withdrawal`, outcome, order });
    const fresh = await engine.refresh(db2, { clientId, resource, refreshToken: tokens.refreshToken }).then(() => "fulfilled", (error) => error.code);
    expect(["access_denied", "invalid_grant"]).toContain(fresh);
    await expect(engine.validateAccess(db2, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:org:read"] })).rejects.toThrow();
  }, 10000);

  it.each(["begin", "approve", "exchange", "refresh"] as const)("%s uses current membership authority after withdrawal committed while its user read was blocked", async (stage) => {
    const id = newId(), org = newId();
    ownedUsers.push(id); ownedOrganizations.push(org);
    await db.insert(schema.users).values({ id, email: `${id}@fix.invalid` });
    await db.insert(schema.organizations).values({ id: org, name: "Fix stage race", slug: `fix-${org.toLowerCase()}` });
    await db.insert(schema.organizationMembers).values({ userId: id, organizationId: org, role: "owner" });
    const subject = { ...actor, userId: id }, request = { ...input, scopes: ["mcp:org:read" as const], organizationId: org };
    const pending = stage !== "begin" ? await engine.beginAuthorization(db, subject, request) : null;
    const consent = stage === "exchange" || stage === "refresh" ? await engine.approveAuthorization(db, subject, pending!.id) : null;
    const tokens = stage === "refresh" ? await engine.exchangeCode(db, { clientId, redirectUri, resource, code: consent!.code, codeVerifier: verifier }) : null;
    const blocker = await pool2.getConnection();
    await blocker.beginTransaction();
    await blocker.execute("SELECT id FROM users WHERE id=? FOR UPDATE", [id]);
    let reached!: () => void;
    const atUser = new Promise<void>((resolve) => { reached = resolve; });
    onQuery = (query) => { if (query.includes("from `users`") && query.includes("for share")) reached(); };
    const call = stage === "begin" ? engine.beginAuthorization(db, subject, request)
      : stage === "approve" ? engine.approveAuthorization(db, subject, pending!.id)
      : stage === "exchange" ? engine.exchangeCode(db, { clientId, redirectUri, resource, code: consent!.code, codeVerifier: verifier })
      : engine.refresh(db, { clientId, resource, refreshToken: tokens!.refreshToken });
    const outcome = call.then(() => "fulfilled", (error) => error.code);
    await atUser;
    try {
      await db2.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, org));
      expect(await db2.select().from(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, org))).toHaveLength(0);
    } finally { await blocker.commit(); blocker.release(); onQuery = undefined; }
    expect(await outcome).toBe("access_denied");
    const grants = await db2.select().from(schema.oauthGrants).where(eq(schema.oauthGrants.userId, id));
    expect(grants.length).toBe(stage === "begin" ? 0 : 1);
    if (stage === "approve") expect(grants[0]!.approvedAt).toBeNull();
    if (stage === "exchange") {
      expect(grants[0]!.codeUsedAt).toBeNull();
      expect(await db2.select().from(schema.oauthFamilies).where(eq(schema.oauthFamilies.grantId, pending!.id))).toHaveLength(0);
    }
    if (stage === "refresh") {
      const [family] = await db2.select().from(schema.oauthFamilies).where(eq(schema.oauthFamilies.grantId, pending!.id));
      const rows = await db2.select().from(schema.oauthTokens).where(eq(schema.oauthTokens.familyId, family!.id));
      expect(rows.length).toBe(2);
      expect(rows.find((row) => row.kind === "refresh")!.usedAt).toBeNull();
    }
  }, 10000);

  it("access validation does not authorize a snapshot after family revocation commits while its subject read is blocked", async () => {
    const tokens = await issue();
    const blocker = await pool2.getConnection();
    await blocker.beginTransaction();
    await blocker.execute("SELECT id FROM users WHERE id=? FOR UPDATE", [userId]);
    let reached!: () => void;
    const atUser = new Promise<void>((resolve) => { reached = resolve; });
    onQuery = (query) => { if (query.includes("from `users`") && query.includes("for share")) reached(); };
    const validating = engine.validateAccess(db, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:profile:read"] }).then(() => "fulfilled", (error) => error.code);
    await atUser;
    try { await engine.revoke(db2, { clientId, token: tokens.refreshToken }); }
    finally { await blocker.commit(); blocker.release(); onQuery = undefined; }
    expect(await validating).toBe("invalid_token");
  }, 10000);

  it("serializes code and refresh replay across two independently constructed pools", async () => {
    const grant = await approved();
    const exchanges = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => engine.exchangeCode(i % 2 ? db : db2, { clientId, redirectUri, resource, code: grant.code, codeVerifier: verifier })));
    expect(exchanges.filter((result) => result.status === "fulfilled").length).toBe(1);
    for (const result of exchanges) if (result.status === "rejected") expect(result.reason.code).toBe("invalid_grant");
    const tokens = await issue();
    const rotations = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => engine.refresh(i % 2 ? db : db2, { clientId, resource, refreshToken: tokens.refreshToken })));
    expect(rotations.filter((result) => result.status === "fulfilled").length).toBe(1);
    for (const result of rotations) {
      if (result.status === "rejected") expect(result.reason.code).toBe("invalid_grant");
      else await expect(engine.validateAccess(db2, { token: result.value.accessToken, clientId, resource, scopes: ["mcp:profile:read"] })).rejects.toMatchObject({ code: "invalid_token" });
    }
    const active = await issue();
    const outcomes = await Promise.allSettled([
      engine.refresh(db, { clientId, resource, refreshToken: active.refreshToken }),
      engine.revoke(db2, { clientId, token: active.refreshToken }),
    ]);
    expect(outcomes[1]!.status).toBe("fulfilled");
    if (outcomes[0]!.status === "rejected") expect(outcomes[0]!.reason.code).toBe("invalid_grant");
    await expect(engine.validateAccess(db2, { token: active.accessToken, clientId, resource, scopes: ["mcp:profile:read"] })).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("purge rechecks token emptiness with a current read after a queued refresh mints beyond its locator snapshot", async () => {
    const timed = new DelegatedOAuth({ issuer, resource, refreshTtlMs: 1000, clock: () => new Date(base.getTime() - 1000) });
    const pending = await timed.beginAuthorization(db, actor, input);
    const { code } = await timed.approveAuthorization(db, actor, pending.id);
    const tokens = await timed.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier });
    const [family] = await db2.select().from(schema.oauthFamilies).where(eq(schema.oauthFamilies.grantId, pending.id));
    const blocker = await pool2.getConnection();
    await blocker.beginTransaction();
    await blocker.execute("SELECT id FROM oauth_families WHERE id=? FOR UPDATE", [family!.id]);
    const refreshing = timed.refresh(db2, { clientId, resource, refreshToken: tokens.refreshToken }).then(() => "fulfilled", (error) => error.code);
    for (let i = 0; i < 200; i++) {
      const [rows] = await pool2.query("SHOW FULL PROCESSLIST");
      if ((rows as { Info?: string }[]).some((row) => row.Info?.includes(family!.id) && row.Info.includes("for update") && row.Info.includes("from `oauth_families`"))) break;
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (i === 199) throw new Error("Refresh did not reach held family");
    }
    let reached!: () => void;
    const atFamily = new Promise<void>((resolve) => { reached = resolve; });
    onQuery = (query) => { if (query.includes("from `oauth_families`") && query.includes("for update")) reached(); };
    const purging = purgeOAuth(db, base, 2);
    await atFamily;
    onQuery = undefined;
    await blocker.commit(); blocker.release();
    expect(await refreshing).toBe("fulfilled");
    const result = await purging;
    expect(result.tokensDeleted).toBe(2);
    expect(result.familiesDeleted).toBe(0);
    expect(await db2.select().from(schema.oauthFamilies).where(eq(schema.oauthFamilies.id, family!.id))).toHaveLength(1);
    expect(await db2.select().from(schema.oauthTokens).where(eq(schema.oauthTokens.familyId, family!.id))).toHaveLength(2);
  }, 10000);

  it("does not invert purge's expiry index with erasure's family grant index", async () => {
    const id = newId(); ownedUsers.push(id);
    await db.insert(schema.users).values({ id, email: `${id}@fix.invalid` });
    const subject = { ...actor, userId: id }, familyIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const pending = await engine.beginAuthorization(db, subject, input);
      const { code } = await engine.approveAuthorization(db, subject, pending.id);
      await engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier });
      const [family] = await db2.select().from(schema.oauthFamilies).where(eq(schema.oauthFamilies.grantId, pending.id));
      familyIds.push(family!.id);
    }
    familyIds.sort();
    await db2.delete(schema.oauthTokens).where(inArray(schema.oauthTokens.familyId, familyIds));
    await db2.update(schema.oauthFamilies).set({ expiresAt: base }).where(inArray(schema.oauthFamilies.id, familyIds));
    await db2.delete(schema.users).where(eq(schema.users.id, id));
    const blocker = await pool2.getConnection();
    await blocker.beginTransaction();
    await blocker.execute("SELECT id FROM oauth_families WHERE id=? FOR UPDATE", [familyIds[1]!]);
    const purge = purgeOAuth(db, base, 500).then(() => "fulfilled", (error) => error.code);
    async function observe(pattern: (query: string) => boolean) {
      for (let i = 0; i < 200; i++) {
        const [rows] = await pool2.query("SHOW FULL PROCESSLIST");
        if ((rows as { Info?: string }[]).some((row) => row.Info && pattern(row.Info))) return;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      throw new Error("Expected blocked family statement was not observed");
    }
    await observe((query) => query.includes("from `oauth_families`") && query.includes("expires_at") && query.includes("for update"));
    const erasure = eraseOAuthUserBatch(db2, id, 2).then(() => "fulfilled", (error) => error.code);
    try { await observe((query) => query.includes("from `oauth_families`") && query.includes("grant_id") && query.includes("for update")); }
    finally { await blocker.commit(); blocker.release(); }
    expect(await purge).toBe("fulfilled");
    expect(await erasure).toBe("fulfilled");
  }, 10000);

  it("does not invert erasure's subject index with purge's primary grant locks", async () => {
    const id = newId(); ownedUsers.push(id);
    await db.insert(schema.users).values({ id, email: `${id}@fix.invalid` });
    const subject = { ...actor, userId: id };
    const first = await engine.beginAuthorization(db, subject, input);
    const second = await engine.beginAuthorization(db, subject, input);
    await db2.update(schema.oauthGrants).set({ expiresAt: base }).where(inArray(schema.oauthGrants.id, [first.id, second.id]));
    await db2.delete(schema.users).where(eq(schema.users.id, id));
    const blocker = await pool2.getConnection();
    await blocker.beginTransaction();
    await blocker.execute("SELECT id FROM oauth_grants WHERE id=? FOR UPDATE", [second.id]);
    const purge = purgeOAuth(db, base, 500).then(() => "fulfilled", (error) => error.code);
    async function observe(pattern: (query: string) => boolean) {
      for (let i = 0; i < 200; i++) {
        const [rows] = await pool2.query("SHOW FULL PROCESSLIST");
        if ((rows as { Info?: string }[]).some((row) => row.Info && pattern(row.Info))) return;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      throw new Error("Expected blocked grant statement was not observed");
    }
    await observe((query) => query.includes(second.id) && query.includes("order by") && query.includes("for update"));
    const erasure = eraseOAuthUserBatch(db2, id, 2).then(() => "fulfilled", (error) => error.code);
    try { await observe((query) => query.includes("`user_id`") && query.includes("from `oauth_grants`") && query.includes("for update")); }
    finally { await blocker.commit(); blocker.release(); }
    expect(await purge).toBe("fulfilled");
    expect(await erasure).toBe("fulfilled");
  }, 10000);

  it("does not invert organization revocation and account erasure through secondary grant indexes", async () => {
    const id = newId(), org = newId(); ownedUsers.push(id); ownedOrganizations.push(org);
    await db.insert(schema.users).values({ id, email: `${id}@fix.invalid` });
    await db.insert(schema.organizations).values({ id: org, name: "Index lock fixture", slug: `fix-${org.toLowerCase()}` });
    await db.insert(schema.organizationMembers).values({ userId: id, organizationId: org, role: "owner" });
    const subject = { ...actor, userId: id };
    const pending = await engine.beginAuthorization(db, subject, { ...input, scopes: ["mcp:org:read"], organizationId: org });
    const { code } = await engine.approveAuthorization(db, subject, pending.id);
    await engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier });
    const [family] = await db2.select().from(schema.oauthFamilies).where(eq(schema.oauthFamilies.grantId, pending.id));
    await db2.delete(schema.oauthTokens).where(eq(schema.oauthTokens.familyId, family!.id));
    await db2.delete(schema.users).where(eq(schema.users.id, id));
    const blocker = await pool2.getConnection();
    await blocker.beginTransaction();
    await blocker.execute("SELECT id FROM oauth_families WHERE id=? FOR UPDATE", [family!.id]);
    let reached!: () => void;
    const atFamily = new Promise<void>((resolve) => { reached = resolve; });
    onQuery = (query) => { if (query.includes("from `oauth_families`") && query.includes("for update")) reached(); };
    const erasure = eraseOAuthUserBatch(db, id, 1).then(() => "fulfilled", (error) => error.code);
    await atFamily;
    onQuery = undefined;
    let deleted = false;
    const deletion = deleteOrganization(db2, org, base).then(() => { deleted = true; return "fulfilled"; }, (error) => { deleted = true; return error.code; });
    try {
      for (let i = 0; i < 200 && !deleted; i++) {
        const [rows] = await pool2.query("SHOW FULL PROCESSLIST");
        if ((rows as { Info?: string }[]).some((row) => row.Info?.startsWith("update `oauth_grants`") || (row.Info?.includes("from `oauth_grants`") && row.Info.includes("for update")))) break;
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (i === 199) throw new Error("Organization revocation did not reach server");
      }
    } finally { await blocker.commit(); blocker.release(); }
    expect(await erasure).toBe("fulfilled");
    expect(await deletion).toBe("fulfilled");
  }, 10000);

  it("releases purge family locks before grant cleanup while actual revoke and erasure overlap", async () => {
    const id = newId(); ownedUsers.push(id);
    await db.insert(schema.users).values({ id, email: `${id}@fix.invalid` });
    const subject = { ...actor, userId: id };
    const pending = await engine.beginAuthorization(db, subject, input);
    const { code } = await engine.approveAuthorization(db, subject, pending.id);
    const tokens = await engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier });
    const [family] = await db2.select().from(schema.oauthFamilies).where(eq(schema.oauthFamilies.grantId, pending.id));
    await db2.update(schema.oauthFamilies).set({ expiresAt: base }).where(eq(schema.oauthFamilies.id, family!.id));
    await db2.update(schema.oauthGrants).set({ expiresAt: base }).where(eq(schema.oauthGrants.id, pending.id));
    await db2.delete(schema.users).where(eq(schema.users.id, id));
    const blocker = await pool2.getConnection();
    await blocker.beginTransaction();
    await blocker.execute("SELECT id FROM oauth_grants WHERE id=? FOR UPDATE", [pending.id]);
    let reached!: () => void;
    const atFamily = new Promise<void>((resolve) => { reached = resolve; });
    onQuery = (query) => { if (query.includes("from `oauth_families`") && query.includes("for update")) reached(); };
    const purge = purgeOAuth(db, base, 500);
    const purgeOutcome = purge.then(() => "fulfilled", (error) => {
      const query = String(error.sql ?? error.cause?.sql ?? "");
      return `${error.code}:${query.split(" ")[0]}:${["oauth_grants", "oauth_families", "oauth_tokens"].filter((table) => query.includes(table)).join(",")}`;
    });
    await atFamily;
    onQuery = undefined;
    const others = Promise.allSettled([
      engine.revoke(db2, { clientId, token: tokens.refreshToken }),
      eraseOAuthUserBatch(db2, id, 1),
      engine.refresh(db2, { clientId, resource, refreshToken: tokens.refreshToken }),
    ]);
    try { await blocker.execute("SELECT id FROM oauth_families WHERE id=? FOR UPDATE", [family!.id]); }
    finally { await blocker.commit(); blocker.release(); }
    expect(await purgeOutcome).toBe("fulfilled");
    const outcomes = await others;
    expect(outcomes[0]!.status).toBe("fulfilled");
    expect(outcomes[1]!.status).toBe("fulfilled");
    expect(outcomes[2]!.status).toBe("rejected");
    if (outcomes[2]!.status === "rejected") expect(["access_denied", "invalid_grant"]).toContain(outcomes[2]!.reason.code);
  }, 10000);

  it("stops cleanup admission at a zero-duration budget after committing account invalidation", async () => {
    const id = newId();
    ownedUsers.push(id);
    await db.insert(schema.users).values({ id, email: `${id}@fix.invalid` });
    const pending = await engine.beginAuthorization(db, { ...actor, userId: id }, input);
    let transactions = 0;
    const counted = new Proxy(db, { get(target, key) {
      if (key === "transaction") return (...args: Parameters<Database["transaction"]>) => { transactions++; return target.transaction(...args); };
      return Reflect.get(target, key);
    } });
    const result = await deleteOAuthUser(counted, id, base, { maxDurationMs: 0 });
    expect(transactions).toBe(1);
    expect(result).toMatchObject({ batches: 0, deleted: 0, hasMore: true, resumeUserId: id });
    expect(await db2.select().from(schema.users).where(eq(schema.users.id, id))).toHaveLength(0);
    await expect(engine.approveAuthorization(db2, { ...actor, userId: id }, pending.id)).rejects.toMatchObject({ code: "access_denied" });
    expect((await deleteOAuthUser(db2, id)).hasMore).toBe(false);
  });

  it("returns expiry seconds from the persisted access expiry and the response clock", async () => {
    let inserted = false;
    const timed = new DelegatedOAuth({ issuer, resource, accessTtlMs: 2000, refreshTtlMs: 10000, clock: () => new Date(base.getTime() + (inserted ? 1001 : 0)) });
    const pending = await timed.beginAuthorization(db, actor, input);
    const { code } = await timed.approveAuthorization(db, actor, pending.id);
    onQuery = (query) => { if (query.startsWith("insert into `oauth_tokens`")) inserted = true; };
    let result;
    try { result = await timed.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier }); }
    finally { onQuery = undefined; }
    const [row] = await db2.select({ expiresAt: schema.oauthTokens.expiresAt }).from(schema.oauthTokens).where(eq(schema.oauthTokens.tokenHash, createHash("sha256").update(result.accessToken).digest("hex")));
    expect(row!.expiresAt.getTime()).toBe(base.getTime() + 2000);
    expect(result.expiresIn).toBe(0);
  });

  it("rolls back newly inserted refresh material when expiry is crossed only at the response clock", async () => {
    const tokens = await issue();
    const [family] = await db2.select().from(schema.oauthFamilies).where(eq(schema.oauthFamilies.grantId, tokens.grantId));
    clock = () => new Date(base.getTime() + 999);
    onQuery = (query) => { if (query.startsWith("insert into `oauth_tokens`")) clock = () => new Date(base.getTime() + 2001); };
    try {
      const outcome = await engine.refresh(db, { clientId, resource, refreshToken: tokens.refreshToken }).then(() => "fulfilled", (error) => error.code);
      expect(outcome).toBe("invalid_grant");
      const rows = await db2.select().from(schema.oauthTokens).where(eq(schema.oauthTokens.familyId, family!.id));
      expect(rows.length).toBe(2);
      expect(rows.find((row) => row.kind === "refresh")!.usedAt).toBeNull();
    } finally { onQuery = undefined; clock = () => base; }
  });

  it("rolls back code consumption when code expires after validation but before response", async () => {
    clock = () => base;
    const grant = await approved();
    let reads = 0;
    clock = () => new Date(base.getTime() + (++reads <= 3 ? 119999 : 120001));
    try {
      const outcome = await engine.exchangeCode(db, { clientId, redirectUri, resource, code: grant.code, codeVerifier: verifier }).then(() => "fulfilled", (error) => error.code);
      expect(outcome).toBe("invalid_grant");
      const [row] = await db2.select().from(schema.oauthGrants).where(eq(schema.oauthGrants.id, grant.id));
      expect(row!.codeUsedAt).toBeNull();
      expect(await db2.select().from(schema.oauthFamilies).where(eq(schema.oauthFamilies.grantId, grant.id))).toHaveLength(0);
    } finally { clock = () => base; }
  });

  it("rolls back refresh consumption and inserted tokens when the clock crosses family expiry during mint", async () => {
    clock = () => base;
    const tokens = await issue();
    const [family] = await db2.select().from(schema.oauthFamilies).where(eq(schema.oauthFamilies.grantId, tokens.grantId));
    let reads = 0;
    clock = () => new Date(base.getTime() + (++reads <= 2 ? 999 : 2001));
    try {
      const outcome = await engine.refresh(db, { clientId, resource, refreshToken: tokens.refreshToken }).then(() => "fulfilled", (error) => error.code);
      expect(outcome).toBe("invalid_grant");
      const rows = await db2.select().from(schema.oauthTokens).where(eq(schema.oauthTokens.familyId, family!.id));
      expect(rows.length).toBe(2);
      expect(rows.find((row) => row.kind === "refresh")!.usedAt).toBeNull();
    } finally { clock = () => base; }
  });
});
