import { beforeAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { createDb, users, organizations, organizationMembers, oauthClients, oauthGrants, oauthFamilies, oauthTokens } from "@evnelo/db";
import { and, eq, sql } from "drizzle-orm";
import { newId } from "../ids";
import { deleteOrganization, exportOrganizationData } from "../services/privacy";
import { DelegatedOAuth } from "../services/oauth";

const url = process.env.MCP_OAUTH_TEST_DATABASE_URL;
if (url && (new URL(url).hostname !== "127.0.0.1" || new URL(url).port !== "3311" || new URL(url).pathname !== "/evnelo")) throw new Error("OAuth tests require owned loopback 3311 fixture");
const suite = url ? describe : describe.skip;
const db = url ? createDb(url) : null!;
const userId = newId();
const orgId = newId();
const clientId = `f1a-${newId()}`;
const redirectUri = "http://127.0.0.1:49213/callback";
const issuer = "http://localhost:3901";
const resource = `${issuer}/mcp`;
let now = new Date("2026-10-01T12:00:00Z");
const engine = new DelegatedOAuth({ issuer, resource, clock: () => now });
const verifier = "a".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const actor = { userId, sessionNonce: "fixture-session-nonce-32-characters" };

async function issue(scopes: ("mcp:profile:read" | "mcp:org:read")[] = ["mcp:profile:read"], organizationId?: string) {
  const pending = await engine.beginAuthorization(db, actor, { clientId, redirectUri, resource, scopes, organizationId, codeChallenge: challenge, codeChallengeMethod: "S256" });
  const { code } = await engine.approveAuthorization(db, actor, pending.id);
  return { ...await engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier }), code, grantId: pending.id };
}

suite("delegated authority real MySQL", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "../db/drizzle" });
    await db.insert(users).values({ id: userId, email: `${userId}@f1a.invalid` });
    await db.insert(organizations).values({ id: orgId, name: "OAuth fixture", slug: `f1a-${orgId.toLowerCase()}` });
    await db.insert(organizationMembers).values({ organizationId: orgId, userId, role: "owner" });
  });

  it("persists exact bounded public client registration without secrets", async () => {
    expect(engine.registerClient).toBeTypeOf("function");
    const client = await engine.registerClient(db, { clientId, redirectUris: [redirectUri], scopes: ["mcp:profile:read", "mcp:org:read"], tokenEndpointAuthMethod: "none" });
    expect(client).toEqual({ id: expect.stringMatching(/^[0-9A-Z]{26}$/), clientId });
    await expect(engine.registerClient(db, { clientId: `bad-${newId()}`, redirectUris: ["http://remote.invalid/cb"], scopes: ["mcp:profile:read"], tokenEndpointAuthMethod: "none" })).rejects.toMatchObject({ code: "invalid_request" });
  });
  it("binds pending consent to trusted user/session and issues one hashed S256 code", async () => {
    expect(engine.beginAuthorization).toBeTypeOf("function");
    const pending = await engine.beginAuthorization(db, actor, { clientId, redirectUri, resource, scopes: ["mcp:org:read"], organizationId: orgId, codeChallenge: challenge, codeChallengeMethod: "S256" });
    await expect(engine.approveAuthorization(db, { ...actor, sessionNonce: "wrong-session-nonce-32-characters" }, pending.id)).rejects.toMatchObject({ code: "access_denied" });
    const approved = await engine.approveAuthorization(db, actor, pending.id);
    expect(approved.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(engine.approveAuthorization(db, actor, pending.id)).rejects.toMatchObject({ code: "invalid_grant" });
  });

  it("exchanges S256 code atomically and validates persisted profile-only access on new handle", async () => {
    expect(engine.exchangeCode).toBeTypeOf("function");
    const pending = await engine.beginAuthorization(db, actor, { clientId, redirectUri, resource, scopes: ["mcp:profile:read"], codeChallenge: challenge, codeChallengeMethod: "S256" });
    const { code } = await engine.approveAuthorization(db, actor, pending.id);
    const tokens = await engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier });
    expect(tokens).toMatchObject({ tokenType: "Bearer", expiresIn: 600, scope: "mcp:profile:read", accessToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), refreshToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
    expect(await engine.validateAccess(createDb(url), { token: tokens.accessToken, clientId, resource, scopes: ["mcp:profile:read"] })).toEqual({ userId, organizationId: null, scopes: ["mcp:profile:read"], grantId: pending.id });
    await expect(engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier })).rejects.toMatchObject({ code: "invalid_grant" });
  });
  it("rotates refresh once and commits family revocation before rejecting valid reuse", async () => {
    expect(engine.refresh).toBeTypeOf("function");
    const tokens = await issue();
    const rotated = await engine.refresh(db, { clientId, resource, refreshToken: tokens.refreshToken });
    expect(rotated.refreshToken).not.toBe(tokens.refreshToken);
    await engine.validateAccess(db, { token: rotated.accessToken, clientId, resource, scopes: ["mcp:profile:read"] });
    await expect(engine.refresh(db, { clientId, resource, refreshToken: tokens.refreshToken })).rejects.toMatchObject({ code: "invalid_grant" });
    for (const token of [tokens.accessToken, rotated.accessToken]) await expect(engine.validateAccess(db, { token, clientId, resource, scopes: ["mcp:profile:read"] })).rejects.toMatchObject({ code: "invalid_token" });
    await expect(engine.refresh(db, { clientId, resource, refreshToken: rotated.refreshToken })).rejects.toMatchObject({ code: "invalid_grant" });
  });
  it("revokes a token family only for its client and returns identical idempotent empty result", async () => {
    expect(engine.revoke).toBeTypeOf("function");
    const tokens = await issue();
    const otherClientId = `other-${newId()}`;
    await engine.registerClient(db, { clientId: otherClientId, redirectUris: [redirectUri], scopes: ["mcp:profile:read"], tokenEndpointAuthMethod: "none" });
    expect(await engine.revoke(db, { clientId: otherClientId, token: tokens.refreshToken })).toBeUndefined();
    await engine.validateAccess(db, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:profile:read"] });
    expect(await engine.revoke(db, { clientId, token: tokens.accessToken })).toBeUndefined();
    expect(await engine.revoke(db, { clientId, token: tokens.accessToken })).toBeUndefined();
    expect(await engine.revoke(db, { clientId, token: "z".repeat(43) })).toBeUndefined();
    await expect(engine.validateAccess(db, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:profile:read"] })).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("serializes concurrent code redemptions to one controlled success", async () => {
    const pending = await engine.beginAuthorization(db, actor, { clientId, redirectUri, resource, scopes: ["mcp:profile:read"], codeChallenge: challenge, codeChallengeMethod: "S256" });
    const { code } = await engine.approveAuthorization(db, actor, pending.id);
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const result of results) if (result.status === "rejected") expect(result.reason).toMatchObject({ code: "invalid_grant" });
  });

  it("serializes concurrent refresh to one success and committed reuse revocation", async () => {
    const tokens = await issue();
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => engine.refresh(db, { clientId, resource, refreshToken: tokens.refreshToken })));
    const successes = results.filter((r) => r.status === "fulfilled");
    expect(successes).toHaveLength(1);
    for (const result of results) if (result.status === "rejected") expect(result.reason).toMatchObject({ code: "invalid_grant" });
    for (const result of successes) if (result.status === "fulfilled") await expect(engine.validateAccess(db, { token: result.value.accessToken, clientId, resource, scopes: ["mcp:profile:read"] })).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("does not consume a code on incorrect client, redirect, resource or verifier", async () => {
    const other = `binding-${newId()}`;
    await engine.registerClient(db, { clientId: other, redirectUris: [redirectUri], scopes: ["mcp:profile:read"], tokenEndpointAuthMethod: "none" });
    const pending = await engine.beginAuthorization(db, actor, { clientId, redirectUri, resource, scopes: ["mcp:profile:read"], codeChallenge: challenge, codeChallengeMethod: "S256" });
    const { code } = await engine.approveAuthorization(db, actor, pending.id);
    const valid = { clientId, redirectUri, resource, code, codeVerifier: verifier };
    for (const wrong of [{ clientId: other }, { redirectUri: `${redirectUri}?x=1` }, { resource: `${resource}/wrong` }, { codeVerifier: "b".repeat(43) }]) {
      await expect(engine.exchangeCode(db, { ...valid, ...wrong })).rejects.toMatchObject({ code: "invalid_grant" });
    }
    await expect(engine.exchangeCode(db, { ...valid, codeVerifier: "short" })).rejects.toMatchObject({ code: "invalid_request" });
    await engine.exchangeCode(db, valid);
  });

  it("wrong refresh client, resource and scope cannot rotate or revoke a family even after reuse", async () => {
    const other = `refresh-${newId()}`;
    await engine.registerClient(db, { clientId: other, redirectUris: [redirectUri], scopes: ["mcp:profile:read"], tokenEndpointAuthMethod: "none" });
    const tokens = await issue();
    const valid = { clientId, resource, refreshToken: tokens.refreshToken };
    for (const used of [false, true]) {
      if (used) await engine.refresh(db, valid);
      await expect(engine.refresh(db, { ...valid, clientId: other })).rejects.toMatchObject({ code: "invalid_grant" });
      await expect(engine.refresh(db, { ...valid, resource: `${resource}/wrong` })).rejects.toMatchObject({ code: "invalid_grant" });
      await expect(engine.refresh(db, { ...valid, scopes: ["mcp:org:read"] })).rejects.toMatchObject({ code: "invalid_scope" });
      await engine.validateAccess(db, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:profile:read"] });
    }
  });

  it("refresh can narrow scopes but a descendant cannot restore surrendered scope", async () => {
    const tokens = await issue(["mcp:profile:read", "mcp:org:read"], orgId);
    const narrowed = await engine.refresh(db, { clientId, resource, refreshToken: tokens.refreshToken, scopes: ["mcp:profile:read"] });
    expect(narrowed.scope).toBe("mcp:profile:read");
    await expect(engine.refresh(db, { clientId, resource, refreshToken: narrowed.refreshToken, scopes: ["mcp:org:read"] })).rejects.toMatchObject({ code: "invalid_scope" });
    await expect(engine.validateAccess(db, { token: narrowed.accessToken, clientId, resource, scopes: ["mcp:org:read"], organizationId: orgId })).rejects.toMatchObject({ code: "access_denied" });
  });

  it("requires exact resource, client, requested scope and protected object organization", async () => {
    const tokens = await issue(["mcp:org:read"], orgId);
    await engine.validateAccess(db, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:org:read"], organizationId: orgId });
    await expect(engine.validateAccess(db, { token: tokens.accessToken, clientId, resource: `${resource}/other`, scopes: ["mcp:org:read"] })).rejects.toMatchObject({ code: "invalid_token" });
    await expect(engine.validateAccess(db, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:org:read"], organizationId: newId() })).rejects.toMatchObject({ code: "access_denied" });
    await expect(engine.validateAccess(db, { token: "ev_live_" + "a".repeat(35), clientId, resource, scopes: ["mcp:org:read"] })).rejects.toMatchObject({ code: "invalid_token" });
  });

  it.each(["user", "organization", "membership", "role", "client", "grant"])("rechecks fresh %s authority on access and refresh", async (change) => {
    const tokens = await issue(["mcp:org:read"], orgId);
    const [client] = await db.select().from(oauthClients).where(eq(oauthClients.clientIdHash, createHash("sha256").update(clientId).digest("hex")));
    try {
      if (change === "user") await db.delete(users).where(eq(users.id, userId));
      if (change === "organization") await db.update(organizations).set({ deletedAt: now }).where(eq(organizations.id, orgId));
      if (change === "membership") await db.delete(organizationMembers).where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, orgId)));
      if (change === "role") await db.update(organizationMembers).set({ role: "checkin" }).where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, orgId)));
      if (change === "client") await db.update(oauthClients).set({ disabledAt: now }).where(eq(oauthClients.id, client!.id));
      if (change === "grant") await db.update(oauthGrants).set({ revokedAt: now }).where(eq(oauthGrants.id, tokens.grantId));
      const code = change === "client" ? "invalid_client" : "access_denied";
      await expect(engine.validateAccess(db, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:org:read"], organizationId: orgId })).rejects.toMatchObject({ code });
      await expect(engine.refresh(db, { clientId, resource, refreshToken: tokens.refreshToken })).rejects.toMatchObject({ code });
    } finally {
      if (change === "user") await db.insert(users).values({ id: userId, email: `${userId}@f1a.invalid` });
      if (change === "organization") await db.update(organizations).set({ deletedAt: null }).where(eq(organizations.id, orgId));
      if (change === "membership") await db.insert(organizationMembers).values({ organizationId: orgId, userId, role: "owner" });
      if (change === "role") await db.update(organizationMembers).set({ role: "owner" }).where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, orgId)));
      if (change === "client") await db.update(oauthClients).set({ disabledAt: null }).where(eq(oauthClients.id, client!.id));
    }
  });

  it("allows profile-only linking for a real user with no memberships", async () => {
    const id = newId();
    await db.insert(users).values({ id, email: `${id}@f1a.invalid` });
    const subject = { ...actor, userId: id };
    const pending = await engine.beginAuthorization(db, subject, { clientId, redirectUri, resource, scopes: ["mcp:profile:read"], codeChallenge: challenge, codeChallengeMethod: "S256" });
    const { code } = await engine.approveAuthorization(db, subject, pending.id);
    const tokens = await engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier });
    expect(await engine.validateAccess(db, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:profile:read"] })).toMatchObject({ userId: id, organizationId: null });
    await expect(engine.beginAuthorization(db, subject, { clientId, redirectUri, resource, scopes: ["mcp:org:read"], codeChallenge: challenge, codeChallengeMethod: "S256" })).rejects.toMatchObject({ code: "access_denied" });
    await db.delete(users).where(eq(users.id, id));
  });

  it("persists only credential hashes and returns an allowlisted authority DTO", async () => {
    const tokens = await issue();
    const [grant] = await db.select().from(oauthGrants).where(eq(oauthGrants.id, tokens.grantId));
    const [family] = await db.select().from(oauthFamilies).where(eq(oauthFamilies.grantId, tokens.grantId));
    const rows = await db.select().from(oauthTokens).where(eq(oauthTokens.familyId, family!.id));
    const serialized = JSON.stringify({ grant, family, rows });
    for (const secret of [tokens.code, tokens.accessToken, tokens.refreshToken, actor.sessionNonce, verifier]) expect(serialized.includes(secret)).toBe(false);
    expect(rows.map((row) => row.tokenHash)).toContain(createHash("sha256").update(tokens.accessToken).digest("hex"));
    const authority = await engine.validateAccess(db, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:profile:read"] });
    expect(Object.keys(authority).sort()).toEqual(["grantId", "organizationId", "scopes", "userId"]);
  });

  it("expires pending consent, codes, access and refresh families using the test clock", async () => {
    const base = now;
    try {
      const pending = await engine.beginAuthorization(db, actor, { clientId, redirectUri, resource, scopes: ["mcp:profile:read"], codeChallenge: challenge, codeChallengeMethod: "S256" });
      now = new Date(base.getTime() + 120000);
      await expect(engine.approveAuthorization(db, actor, pending.id)).rejects.toMatchObject({ code: "invalid_grant" });
      now = base;
      const p2 = await engine.beginAuthorization(db, actor, { clientId, redirectUri, resource, scopes: ["mcp:profile:read"], codeChallenge: challenge, codeChallengeMethod: "S256" });
      const { code } = await engine.approveAuthorization(db, actor, p2.id);
      now = new Date(base.getTime() + 120000);
      await expect(engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier })).rejects.toMatchObject({ code: "invalid_grant" });
      now = base;
      const tokens = await issue();
      now = new Date(base.getTime() + 600000);
      await expect(engine.validateAccess(db, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:profile:read"] })).rejects.toMatchObject({ code: "invalid_token" });
      const rotated = await engine.refresh(db, { clientId, resource, refreshToken: tokens.refreshToken });
      now = new Date(base.getTime() + 30 * 86400000);
      await expect(engine.refresh(db, { clientId, resource, refreshToken: rotated.refreshToken })).rejects.toMatchObject({ code: "invalid_grant" });
    } finally { now = base; }
  });

  it("rolls back code consumption and family creation after a late token insert failure", async () => {
    const pending = await engine.beginAuthorization(db, actor, { clientId, redirectUri, resource, scopes: ["mcp:profile:read"], codeChallenge: challenge, codeChallengeMethod: "S256" });
    const { code } = await engine.approveAuthorization(db, actor, pending.id);
    const cutoff = new Date(now.getTime() + 12_345);
    now = cutoff;
    await db.execute(sql.raw("ALTER TABLE oauth_tokens ADD CONSTRAINT f1a_oauth_insert_failure CHECK (expires_at <> '2026-10-01 12:10:12.345')"));
    try {
      await expect(engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier })).rejects.toThrow("f1a_oauth_insert_failure");
      const [grant] = await db.select().from(oauthGrants).where(eq(oauthGrants.id, pending.id));
      expect(grant!.codeUsedAt).toBeNull();
      expect(await db.select().from(oauthFamilies).where(eq(oauthFamilies.grantId, pending.id))).toHaveLength(0);
    } finally { await db.execute(sql.raw("ALTER TABLE oauth_tokens DROP CHECK f1a_oauth_insert_failure")); now = new Date(cutoff.getTime() - 12_345); }
    await engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier });
  });
  it("rejects unsafe client metadata IDs, redirect fragments, whitespace and duplicate registrations", async () => {
    for (const bad of ["http://metadata.invalid/client", "https://user@metadata.invalid/client", "https://metadata.invalid/client#", "https://metadata.invalid/client#part"]) {
      await expect(engine.registerClient(db, { clientId: bad, redirectUris: [redirectUri], scopes: ["mcp:profile:read"], tokenEndpointAuthMethod: "none" })).rejects.toMatchObject({ code: "invalid_request" });
    }
    for (const bad of ["https://client.invalid/cb#", " https://client.invalid/cb", "https://client.invalid/cb "]) {
      await expect(engine.registerClient(db, { clientId: `unsafe-${newId()}`, redirectUris: [bad], scopes: ["mcp:profile:read"], tokenEndpointAuthMethod: "none" })).rejects.toMatchObject({ code: "invalid_request" });
    }
    const external = `https://metadata.invalid/${newId()}/${"a".repeat(1900)}`;
    const input = { clientId: external, redirectUris: [redirectUri], scopes: ["mcp:profile:read" as const], tokenEndpointAuthMethod: "none" as const };
    const results = await Promise.allSettled([engine.registerClient(db, input), engine.registerClient(db, input)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const result of results) if (result.status === "rejected") expect(result.reason).toMatchObject({ code: "invalid_client" });
  });
  it("deletes a user and drains scoped credential material in bounded erasure batches", async () => {
    const lifecycle = await import("../services/oauth-lifecycle").catch(() => null);
    expect(lifecycle?.deleteOAuthUser).toBeTypeOf("function");
    const id = newId();
    await db.insert(users).values({ id, email: `${id}@f1a.invalid` });
    const subject = { ...actor, userId: id };
    const pending = await engine.beginAuthorization(db, subject, { clientId, redirectUri, resource, scopes: ["mcp:profile:read"], codeChallenge: challenge, codeChallengeMethod: "S256" });
    const { code } = await engine.approveAuthorization(db, subject, pending.id);
    const tokens = await engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier });
    await engine.refresh(db, { clientId, resource, refreshToken: tokens.refreshToken });
    await lifecycle!.deleteOAuthUser(db, id, now);
    expect(await db.select().from(users).where(eq(users.id, id))).toHaveLength(0);
    expect(await db.select().from(oauthGrants).where(eq(oauthGrants.userId, id))).toHaveLength(0);
    await expect(engine.validateAccess(db, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:profile:read"] })).rejects.toMatchObject({ code: "invalid_token" });
    const retained = await issue();
    expect(await engine.validateAccess(db, { token: retained.accessToken, clientId, resource, scopes: ["mcp:profile:read"] })).toMatchObject({ userId });
  });
  it("wires the Auth.js deletion adapter to erase delegated grants", async () => {
    const { drizzleAdapter } = await import("../../../../apps/web/lib/auth/adapter");
    const id = newId();
    await db.insert(users).values({ id, email: `${id}@f1a.invalid` });
    const pending = await engine.beginAuthorization(db, { ...actor, userId: id }, { clientId, redirectUri, resource, scopes: ["mcp:profile:read"], codeChallenge: challenge, codeChallengeMethod: "S256" });
    await drizzleAdapter(db).deleteUser!(id);
    expect(await db.select().from(oauthGrants).where(eq(oauthGrants.id, pending.id))).toHaveLength(0);
  });
  it("revokes delegated grants through organization privacy deletion", async () => {
    const id = newId();
    await db.insert(organizations).values({ id, name: "Erasure fixture", slug: `f1a-${id.toLowerCase()}` });
    await db.insert(organizationMembers).values({ organizationId: id, userId, role: "owner" });
    const tokens = await issue(["mcp:org:read"], id);
    await deleteOrganization(db, id, now);
    const [grant] = await db.select().from(oauthGrants).where(eq(oauthGrants.id, tokens.grantId));
    expect(grant!.revokedAt).toEqual(now);
    await expect(engine.refresh(db, { clientId, resource, refreshToken: tokens.refreshToken })).rejects.toMatchObject({ code: "access_denied" });
  });
  it("bounds cleanup and retains used refresh digests until family expiry", async () => {
    const lifecycle = await import("../services/oauth-lifecycle");
    expect(lifecycle.purgeOAuth).toBeTypeOf("function");
    const tokens = await issue();
    const rotated = await engine.refresh(db, { clientId, resource, refreshToken: tokens.refreshToken });
    const [family] = await db.select().from(oauthFamilies).where(eq(oauthFamilies.grantId, tokens.grantId));
    await lifecycle.purgeOAuth(db, new Date(now.getTime() + 600000), 2);
    expect(await db.select().from(oauthTokens).where(eq(oauthTokens.familyId, family!.id))).toHaveLength(4);
    const expiry = new Date(now.getTime() + 30 * 86400000);
    for (let i = 0; i < 500; i++) {
      const result = await lifecycle.purgeOAuth(db, expiry, 2);
      expect(result.tokensDeleted).toBeLessThanOrEqual(2);
      expect(result.familiesDeleted).toBeLessThanOrEqual(2);
      expect(result.grantsDeleted).toBeLessThanOrEqual(2);
      if (!(await db.select().from(oauthFamilies).where(eq(oauthFamilies.id, family!.id))).length) break;
    }
    expect(await db.select().from(oauthTokens).where(eq(oauthTokens.familyId, family!.id))).toHaveLength(0);
    expect(await db.select().from(oauthFamilies).where(eq(oauthFamilies.id, family!.id))).toHaveLength(0);
    await expect(engine.refresh(db, { clientId, resource, refreshToken: rotated.refreshToken })).rejects.toMatchObject({ code: "invalid_grant" });
    await expect(lifecycle.purgeOAuth(db, expiry, 0)).rejects.toThrow();
  });
  it("exports bounded subject grant metadata without any credential digests", async () => {
    const lifecycle = await import("../services/oauth-lifecycle");
    expect(lifecycle.exportOAuthAuthority).toBeTypeOf("function");
    const tokens = await issue(["mcp:org:read"], orgId);
    const first = await lifecycle.exportOAuthAuthority(db, userId, { limit: 1 });
    expect(first.grants).toHaveLength(1);
    expect(Object.keys(first.grants[0]!).sort()).toEqual(["approvedAt", "clientId", "createdAt", "id", "organizationId", "revokedAt", "scopes", "userId"]);
    const exported = await exportOrganizationData(db, orgId);
    expect(exported!.delegatedGrants.some((g) => g.id === tokens.grantId)).toBe(true);
    for (const grant of exported!.delegatedGrants) expect(Object.keys(grant).sort()).toEqual(Object.keys(first.grants[0]!).sort());
    const serialized = JSON.stringify({ first, grants: exported!.delegatedGrants });
    for (const secret of [tokens.code, tokens.accessToken, tokens.refreshToken, actor.sessionNonce, createHash("sha256").update(tokens.accessToken).digest("hex")]) expect(serialized.includes(secret)).toBe(false);
    if (first.nextCursor) {
      const next = await lifecycle.exportOAuthAuthority(db, userId, { after: first.nextCursor, limit: 1 });
      expect(next.grants[0]!.id).not.toBe(first.grants[0]!.id);
    }
  });
  it("validates persisted authority from a restarted independent Node process and MySQL pool", async () => {
    const tokens = await issue();
    const child = spawn("../db/node_modules/.bin/tsx", ["src/__tests__/helpers/oauth-restart-probe.ts"], { stdio: ["pipe", "pipe", "pipe"], env: { PATH: process.env.PATH, MCP_OAUTH_TEST_DATABASE_URL: url } });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.resume();
    const exited = new Promise<number | null>((resolve, reject) => { child.on("error", reject); child.on("exit", resolve); });
    child.stdin.end(JSON.stringify({ issuer, resource, now: now.toISOString(), token: tokens.accessToken, clientId, scopes: ["mcp:profile:read"], userId }));
    expect(await exited).toBe(0);
    expect(JSON.parse(output)).toEqual({ persistedAuthorityValid: true });
  });
  it("cannot insert pending credential material behind an in-flight account deletion", async () => {
    const id = newId();
    await db.insert(users).values({ id, email: `${id}@f1a.invalid` });
    let release!: () => void;
    let locked!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const deletion = db.transaction(async (tx) => { await tx.delete(users).where(eq(users.id, id)); locked(); await gate; });
    await ready;
    let settled = false;
    const pending = engine.beginAuthorization(db, { ...actor, userId: id }, { clientId, redirectUri, resource, scopes: ["mcp:profile:read"], codeChallenge: challenge, codeChallengeMethod: "S256" }).then((value) => { settled = true; return { value, error: null }; }, (error) => { settled = true; return { value: null, error }; });
    try {
      await new Promise((resolve) => setTimeout(resolve, 75));
      expect(settled).toBe(false);
    } finally { release(); await deletion; await pending; }
    expect((await pending).error).toMatchObject({ code: "access_denied" });
    expect(await db.select().from(oauthGrants).where(eq(oauthGrants.userId, id))).toHaveLength(0);
  });
  it("does not invert grant-family locks when cleanup overlaps erasure", async () => {
    const { purgeOAuth } = await import("../services/oauth-lifecycle");
    const tokens = await issue();
    const [family] = await db.select().from(oauthFamilies).where(eq(oauthFamilies.grantId, tokens.grantId));
    await db.update(oauthFamilies).set({ expiresAt: now }).where(eq(oauthFamilies.id, family!.id));
    await db.update(oauthGrants).set({ expiresAt: now }).where(eq(oauthGrants.id, tokens.grantId));
    let release!: () => void;
    let locked!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const erasureLocks = db.transaction(async (tx) => {
      await tx.select().from(oauthGrants).where(eq(oauthGrants.id, tokens.grantId)).for("update");
      locked(); await gate;
      await tx.select().from(oauthFamilies).where(eq(oauthFamilies.id, family!.id)).for("update");
    });
    await ready;
    const cleanup = purgeOAuth(db, now, 500);
    // Observe both outcomes immediately to avoid unhandled rejection on a MySQL deadlock.
    const outcomes = Promise.allSettled([erasureLocks, cleanup]);
    await new Promise((resolve) => setTimeout(resolve, 75));
    release();
    const results = await outcomes;
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
  });
  it("rejects wildcard registration rather than treating it as a redirect pattern", async () => {
    for (const uri of ["https://*.client.invalid/cb", "https://client.invalid/*"]) {
      await expect(engine.registerClient(db, { clientId: `wildcard-${newId()}`, redirectUris: [uri], scopes: ["mcp:profile:read"], tokenEndpointAuthMethod: "none" })).rejects.toMatchObject({ code: "invalid_request" });
    }
  });
  it("rejects noncanonical S256 challenge encoding before creating pending consent", async () => {
    const input = { clientId, redirectUri, resource, scopes: ["mcp:profile:read" as const], codeChallenge: `${challenge.slice(0, -1)}B`, codeChallengeMethod: "S256" as const };
    await expect(engine.beginAuthorization(db, actor, input)).rejects.toMatchObject({ code: "invalid_request" });
  });
  it("honors short configured lifetimes with integer OAuth expiry seconds", async () => {
    const base = now;
    const short = new DelegatedOAuth({ issuer, resource, clock: () => now, codeTtlMs: 1000, accessTtlMs: 1500, refreshTtlMs: 3000 });
    try {
      const pending = await short.beginAuthorization(db, actor, { clientId, redirectUri, resource, scopes: ["mcp:profile:read"], codeChallenge: challenge, codeChallengeMethod: "S256" });
      const { code } = await short.approveAuthorization(db, actor, pending.id);
      const tokens = await short.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier });
      expect(tokens.expiresIn).toBe(1);
      now = new Date(base.getTime() + 1500);
      await expect(short.validateAccess(db, { token: tokens.accessToken, clientId, resource, scopes: ["mcp:profile:read"] })).rejects.toMatchObject({ code: "invalid_token" });
      const rotated = await short.refresh(db, { clientId, resource, refreshToken: tokens.refreshToken });
      expect(rotated.expiresIn).toBe(1);
      now = new Date(base.getTime() + 3000);
      await expect(short.refresh(db, { clientId, resource, refreshToken: rotated.refreshToken })).rejects.toMatchObject({ code: "invalid_grant" });
    } finally { now = base; }
  });
  it("denies cross-user consent and stale membership at both code issuance stages", async () => {
    const pending = await engine.beginAuthorization(db, actor, { clientId, redirectUri, resource, scopes: ["mcp:org:read"], organizationId: orgId, codeChallenge: challenge, codeChallengeMethod: "S256" });
    await expect(engine.approveAuthorization(db, { ...actor, userId: newId() }, pending.id)).rejects.toMatchObject({ code: "access_denied" });
    const where = and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, orgId));
    await db.update(organizationMembers).set({ role: "checkin" }).where(where);
    try { await expect(engine.approveAuthorization(db, actor, pending.id)).rejects.toMatchObject({ code: "access_denied" }); }
    finally { await db.update(organizationMembers).set({ role: "owner" }).where(where); }
    const { code } = await engine.approveAuthorization(db, actor, pending.id);
    await db.delete(organizationMembers).where(where);
    try { await expect(engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier })).rejects.toMatchObject({ code: "access_denied" }); }
    finally { await db.insert(organizationMembers).values({ userId, organizationId: orgId, role: "owner" }); }
    await engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier });
  });

  it("rejects unsupported writes, plain PKCE and extra subject fields at the request boundary", async () => {
    const base = { clientId, redirectUri, resource, scopes: ["mcp:profile:read"], codeChallenge: challenge, codeChallengeMethod: "S256" };
    for (const overrides of [{ scopes: ["mcp:org:write"] }, { scopes: [] }, { codeChallengeMethod: "plain" }, { codeChallenge: "short" }, { userId }, { issuer: "https://other.invalid" }, { redirectUri: redirectUri.toUpperCase() }, { resource: "https://other.invalid/mcp" }]) {
      await expect(engine.beginAuthorization(db, actor, { ...base, ...overrides } as Parameters<typeof engine.beginAuthorization>[2])).rejects.toMatchObject({ code: "invalid_request" });
    }
  });

  it("bounds erasure batches and refuses to erase a still-live account", async () => {
    const { eraseOAuthUserBatch } = await import("../services/oauth-lifecycle");
    await expect(eraseOAuthUserBatch(db, userId, 501)).rejects.toThrow();
    await expect(eraseOAuthUserBatch(db, userId, 1)).rejects.toThrow("Delete account");
    const id = newId();
    await db.insert(users).values({ id, email: `${id}@f1a.invalid` });
    const pending = await engine.beginAuthorization(db, { ...actor, userId: id }, { clientId, redirectUri, resource, scopes: ["mcp:profile:read"], codeChallenge: challenge, codeChallengeMethod: "S256" });
    const { code } = await engine.approveAuthorization(db, { ...actor, userId: id }, pending.id);
    await engine.exchangeCode(db, { clientId, redirectUri, resource, code, codeVerifier: verifier });
    await db.delete(users).where(eq(users.id, id));
    let done = false;
    for (let i = 0; i < 8; i++) {
      const batch = await eraseOAuthUserBatch(db, id, 1);
      expect(batch.deleted).toBeLessThanOrEqual(2);
      if (!batch.hasMore) { done = true; break; }
    }
    expect(done).toBe(true);
    expect(await db.select().from(oauthGrants).where(eq(oauthGrants.userId, id))).toHaveLength(0);
  });
  it("bounds pending identifiers before database lookup", async () => {
    await expect(engine.approveAuthorization(db, actor, "x".repeat(4096))).rejects.toMatchObject({ code: "invalid_request" });
  });
  it("strictly validates revocation shape without accepting authority fields", async () => {
    const invalidInputs: unknown[] = [null, { clientId, token: "z".repeat(43), organizationId: orgId }, { clientId, token: "x".repeat(257) }];
    for (const input of invalidInputs) await expect(engine.revoke(db, input as Parameters<typeof engine.revoke>[1])).rejects.toMatchObject({ code: "invalid_request" });
  });

});
