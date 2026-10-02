import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { oauthClients, oauthGrants, oauthFamilies, oauthTokens, users, organizations, organizationMembers, type Database } from "@evnelo/db";
import type { DbOrTx } from "./db";
import { can } from "../permissions";
import { z } from "zod";
import { newId } from "../ids";

export class OAuthError extends Error {
  constructor(readonly code: "invalid_request" | "invalid_client" | "invalid_grant" | "invalid_scope" | "invalid_token" | "access_denied") { super(code); }
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const scopesSchema = z.array(z.enum(["mcp:profile:read", "mcp:org:read"])).min(1).max(2).refine((v) => new Set(v).size === v.length);
const clientSchema = z.object({
  clientId: z.string().min(1).max(2048).regex(/^[\x21-\x7e]+$/),
  redirectUris: z.array(z.string().min(1).max(2048)).min(1).max(8),
  scopes: scopesSchema,
  tokenEndpointAuthMethod: z.literal("none"),
}).strict();

export type OAuthActor = { userId: string; sessionNonce: string };
const actorSchema = z.object({ userId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/), sessionNonce: z.string().min(32).max(256) }).strict();
const authorizationSchema = z.object({
  clientId: clientSchema.shape.clientId, redirectUri: z.string().max(2048), resource: z.string().max(2048),
  scopes: scopesSchema, organizationId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/).optional(),
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/).refine((v) => Buffer.from(v, "base64url").toString("base64url") === v), codeChallengeMethod: z.literal("S256"),
}).strict();
type Grant = typeof oauthGrants.$inferSelect;
// Snapshot reads locate immutable identifiers only; never use them as authority.
const grantLocator = { id: oauthGrants.id, clientId: oauthGrants.clientId, userId: oauthGrants.userId, organizationId: oauthGrants.organizationId };
const opaque = () => randomBytes(32).toString("base64url");

const codeExchangeSchema = z.object({ clientId: clientSchema.shape.clientId, redirectUri: z.string().max(2048), resource: z.string().max(2048), code: z.string().regex(/^[A-Za-z0-9_-]{43}$/), codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/) }).strict();
const refreshSchema = z.object({ clientId: clientSchema.shape.clientId, resource: z.string().max(2048), refreshToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/), scopes: scopesSchema.optional() }).strict();
const revocationSchema = z.object({ clientId: clientSchema.shape.clientId, token: z.string().max(256) }).strict();
const accessSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), clientId: clientSchema.shape.clientId, resource: z.string().max(2048), scopes: scopesSchema, organizationId: z.string().length(26).optional() }).strict();

export type OAuthConfig = { issuer: string; resource: string; clock?: () => Date; codeTtlMs?: number; accessTtlMs?: number; refreshTtlMs?: number };

function secureUrl(value: string): URL {
  const url = new URL(value);
  if (value.length > 2048 || /[\s\\]/.test(value) || value.includes("#") || value.includes("*") || url.username || url.password || url.hash ||
    !(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("Unsafe OAuth URI");
  }
  return url;
}

/** Backend token engine only. No hosted OAuth or consent surface. */
export class DelegatedOAuth {
  private now() { return this.config.clock?.() ?? new Date(); }

  private async client(db: DbOrTx, externalId: string) {
    const [client] = await db.select().from(oauthClients).where(eq(oauthClients.clientIdHash, hash(externalId))).limit(1).for("share");
    if (!client || client.clientId !== externalId || client.disabledAt) throw new OAuthError("invalid_client");
    return client;
  }

  /** Global order: client -> user -> organization -> membership -> grant -> family -> token.
   * Shared authority locks are current reads and survive issuance commit. Deletion/demotion
   * either commits first (and is denied here), or waits for already-authorized issuance.
   * Erasure starts at user/grant; organization deletion at organization/grant; revocation
   * at grant/family. None of those paths acquires an earlier lock afterward.
   */
  private async subject(db: DbOrTx, grant: Pick<Grant, "userId" | "organizationId">) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, grant.userId)).limit(1).for("share");
    if (!user) throw new OAuthError("access_denied");
    if (grant.organizationId) {
      const [org] = await db.select({ deletedAt: organizations.deletedAt }).from(organizations).where(eq(organizations.id, grant.organizationId)).limit(1).for("share");
      if (!org || org.deletedAt) throw new OAuthError("access_denied");
      const [member] = await db.select({ role: organizationMembers.role }).from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, grant.organizationId), eq(organizationMembers.userId, grant.userId))).limit(1).for("share");
      if (!member || !can(member.role, "view_events")) throw new OAuthError("access_denied");
    }
  }

  private async live(db: DbOrTx, grant: Pick<Grant, "userId" | "organizationId" | "scopes" | "issuer" | "resource" | "revokedAt">) {
    if (grant.revokedAt || grant.issuer !== this.config.issuer || grant.resource !== this.config.resource || (grant.scopes.includes("mcp:org:read") && !grant.organizationId)) throw new OAuthError("access_denied");
    await this.subject(db, grant);
  }

  private async lockedGrant(db: DbOrTx, hint: Pick<Grant, "id" | "clientId" | "userId" | "organizationId">, mode: "share" | "update" = "update") {
    await this.subject(db, hint);
    const [grant] = await db.select().from(oauthGrants).where(eq(oauthGrants.id, hint.id)).for(mode);
    if (!grant || grant.clientId !== hint.clientId || grant.userId !== hint.userId || grant.organizationId !== hint.organizationId) throw new OAuthError("invalid_grant");
    return grant;
  }

  /** actor is trusted server session identity, never an OAuth/model request field. */
  async beginAuthorization(db: Database, actor: OAuthActor, input: z.infer<typeof authorizationSchema>) {
    if (!actorSchema.safeParse(actor).success || !authorizationSchema.safeParse(input).success) throw new OAuthError("invalid_request");
    return db.transaction(async (tx) => {
      const client = await this.client(tx, input.clientId);
      if (input.resource !== this.config.resource || !client.redirectUris.includes(input.redirectUri)) throw new OAuthError("invalid_request");
      if (!input.scopes.every((scope) => client.scopes.includes(scope))) throw new OAuthError("invalid_scope");
      const binding = { userId: actor.userId, organizationId: input.organizationId ?? null, scopes: input.scopes, issuer: this.config.issuer, resource: input.resource, revokedAt: null };
      await this.live(tx, binding);
      const id = newId();
      await tx.insert(oauthGrants).values({ ...binding, id, clientId: client.id, redirectUri: input.redirectUri, sessionHash: hash(actor.sessionNonce), codeChallenge: input.codeChallenge, expiresAt: new Date(this.now().getTime() + this.codeTtlMs) });
      return { id };
    });
  }

  async approveAuthorization(db: Database, actor: OAuthActor, pendingId: string) {
    if (!actorSchema.safeParse(actor).success) throw new OAuthError("access_denied");
    if (!actorSchema.shape.userId.safeParse(pendingId).success) throw new OAuthError("invalid_request");
    return db.transaction(async (tx) => {
      const [hint] = await tx.select(grantLocator).from(oauthGrants).where(eq(oauthGrants.id, pendingId)).limit(1);
      if (!hint) throw new OAuthError("invalid_grant");
      const [client] = await tx.select().from(oauthClients).where(eq(oauthClients.id, hint.clientId)).limit(1).for("share");
      if (!client || client.disabledAt) throw new OAuthError("invalid_client");
      const grant = await this.lockedGrant(tx, hint);
      if (grant.approvedAt || grant.expiresAt <= this.now()) throw new OAuthError("invalid_grant");
      if (grant.userId !== actor.userId || grant.sessionHash !== hash(actor.sessionNonce)) throw new OAuthError("access_denied");
      await this.live(tx, grant);
      const code = opaque();
      await tx.update(oauthGrants).set({ approvedAt: this.now(), codeHash: hash(code), expiresAt: new Date(this.now().getTime() + this.codeTtlMs) }).where(eq(oauthGrants.id, grant.id));
      return { code };
    });
  }

  private async mint(db: DbOrTx, familyId: string, familyExpiry: Date, scopes: string[], codeExpiry?: Date) {
    const mintedAt = this.now();
    const accessExpiresAt = new Date(Math.min(mintedAt.getTime() + this.accessTtlMs, familyExpiry.getTime()));
    if (familyExpiry <= mintedAt || (codeExpiry && codeExpiry <= mintedAt)) throw new OAuthError("invalid_grant");
    const accessToken = opaque();
    const refreshToken = opaque();
    await db.insert(oauthTokens).values([
      { id: newId(), familyId, tokenHash: hash(accessToken), kind: "access", scopes, expiresAt: accessExpiresAt },
      { id: newId(), familyId, tokenHash: hash(refreshToken), kind: "refresh", scopes, expiresAt: familyExpiry },
    ]);
    const responseAt = this.now();
    if (accessExpiresAt <= responseAt || familyExpiry <= responseAt || (codeExpiry && codeExpiry <= responseAt)) throw new OAuthError("invalid_grant");
    return { accessToken, refreshToken, tokenType: "Bearer" as const, expiresIn: Math.floor((accessExpiresAt.getTime() - responseAt.getTime()) / 1000), scope: scopes.join(" ") };
  }

  async exchangeCode(db: Database, input: z.infer<typeof codeExchangeSchema>) {
    if (!codeExchangeSchema.safeParse(input).success) throw new OAuthError("invalid_request");
    return db.transaction(async (tx) => {
      const client = await this.client(tx, input.clientId);
      const [hint] = await tx.select(grantLocator).from(oauthGrants).where(eq(oauthGrants.codeHash, hash(input.code))).limit(1);
      if (!hint) throw new OAuthError("invalid_grant");
      const grant = await this.lockedGrant(tx, hint);
      if (!grant.approvedAt || grant.codeUsedAt || grant.expiresAt <= this.now() || grant.clientId !== client.id || grant.redirectUri !== input.redirectUri || grant.resource !== input.resource ||
        grant.codeChallenge !== createHash("sha256").update(input.codeVerifier).digest("base64url")) throw new OAuthError("invalid_grant");
      await this.live(tx, grant);
      const familyId = newId();
      const expiresAt = new Date(this.now().getTime() + this.refreshTtlMs);
      await tx.update(oauthGrants).set({ codeUsedAt: this.now() }).where(eq(oauthGrants.id, grant.id));
      await tx.insert(oauthFamilies).values({ id: familyId, grantId: grant.id, expiresAt });
      return this.mint(tx, familyId, expiresAt, grant.scopes, grant.expiresAt);
    });
  }

  async refresh(db: Database, input: z.infer<typeof refreshSchema>) {
    if (!refreshSchema.safeParse(input).success) throw new OAuthError("invalid_request");
    const result = await db.transaction(async (tx) => {
      const client = await this.client(tx, input.clientId);
      const [hint] = await tx.select({ tokenId: oauthTokens.id, familyId: oauthFamilies.id, grant: grantLocator }).from(oauthTokens)
        .innerJoin(oauthFamilies, eq(oauthFamilies.id, oauthTokens.familyId)).innerJoin(oauthGrants, eq(oauthGrants.id, oauthFamilies.grantId))
        .where(eq(oauthTokens.tokenHash, hash(input.refreshToken))).limit(1);
      if (!hint) throw new OAuthError("invalid_grant");
      const grant = await this.lockedGrant(tx, hint.grant);
      const [family] = await tx.select().from(oauthFamilies).where(eq(oauthFamilies.id, hint.familyId)).for("update");
      const [token] = await tx.select().from(oauthTokens).where(eq(oauthTokens.id, hint.tokenId)).for("update");
      if (!family || !token || token.kind !== "refresh" || family.grantId !== grant.id || token.familyId !== family.id || family.revokedAt || family.expiresAt <= this.now() || token.expiresAt <= this.now() || grant.clientId !== client.id || grant.resource !== input.resource) throw new OAuthError("invalid_grant");
      const scopes = input.scopes ?? token.scopes;
      if (!scopes.every((scope) => token.scopes.includes(scope))) throw new OAuthError("invalid_scope");
      await this.live(tx, grant);
      if (token.usedAt) {
        await tx.update(oauthFamilies).set({ revokedAt: this.now() }).where(eq(oauthFamilies.id, family.id));
        // Return, don't throw here: rollback would undo the security effect.
        return null;
      }
      await tx.update(oauthTokens).set({ usedAt: this.now() }).where(eq(oauthTokens.id, token.id));
      return this.mint(tx, family.id, family.expiresAt, scopes);
    });
    if (!result) throw new OAuthError("invalid_grant");
    return result;
  }

  async validateAccess(db: Database, input: z.infer<typeof accessSchema>) {
    if (!accessSchema.safeParse(input).success) throw new OAuthError("invalid_token");
    return db.transaction(async (tx) => {
      const client = await this.client(tx, input.clientId);
      const [hint] = await tx.select({ tokenId: oauthTokens.id, familyId: oauthFamilies.id, grant: grantLocator }).from(oauthTokens)
        .innerJoin(oauthFamilies, eq(oauthFamilies.id, oauthTokens.familyId)).innerJoin(oauthGrants, eq(oauthGrants.id, oauthFamilies.grantId))
        .where(eq(oauthTokens.tokenHash, hash(input.token))).limit(1);
      if (!hint) throw new OAuthError("invalid_token");
      const grant = await this.lockedGrant(tx, hint.grant, "share");
      const [family] = await tx.select().from(oauthFamilies).where(eq(oauthFamilies.id, hint.familyId)).for("share");
      const [token] = await tx.select().from(oauthTokens).where(eq(oauthTokens.id, hint.tokenId)).for("share");
      if (!family || !token || token.kind !== "access" || token.familyId !== family.id || family.grantId !== grant.id || token.expiresAt <= this.now() || family.expiresAt <= this.now() || family.revokedAt || grant.clientId !== client.id || grant.resource !== input.resource) throw new OAuthError("invalid_token");
      if (!input.scopes.every((scope) => token.scopes.includes(scope)) || (input.organizationId !== undefined && input.organizationId !== grant.organizationId)) throw new OAuthError("access_denied");
      await this.live(tx, grant);
      return { userId: grant.userId, organizationId: grant.organizationId, scopes: token.scopes, grantId: grant.id };
    });
  }

  async revoke(db: Database, input: { clientId: string; token: string }): Promise<void> {
    if (!revocationSchema.safeParse(input).success) throw new OAuthError("invalid_request");
    // Unknown, malformed, wrong-client and already revoked tokens have the same result.
    await db.transaction(async (tx) => {
      const client = await this.client(tx, input.clientId);
      if (!/^[A-Za-z0-9_-]{43}$/.test(input.token)) return;
      const [row] = await tx.select({ familyId: oauthTokens.familyId, grantId: oauthGrants.id }).from(oauthTokens)
        .innerJoin(oauthFamilies, eq(oauthFamilies.id, oauthTokens.familyId)).innerJoin(oauthGrants, eq(oauthGrants.id, oauthFamilies.grantId))
        .where(eq(oauthTokens.tokenHash, hash(input.token))).limit(1);
      if (!row) return;
      const [grant] = await tx.select({ clientId: oauthGrants.clientId }).from(oauthGrants).where(eq(oauthGrants.id, row.grantId)).for("update");
      if (!grant || grant.clientId !== client.id) return;
      await tx.update(oauthFamilies).set({ revokedAt: this.now() }).where(eq(oauthFamilies.id, row.familyId));
    });
  }

  async registerClient(db: Database, input: z.infer<typeof clientSchema>) {
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) throw new OAuthError("invalid_request");
    try {
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(input.clientId)) {
        const metadata = secureUrl(input.clientId);
        if (metadata.protocol !== "https:" || input.clientId.includes("#")) throw new Error();
      }
      for (const uri of input.redirectUris) secureUrl(uri);
      if (new Set(input.redirectUris).size !== input.redirectUris.length) throw new Error();
    } catch { throw new OAuthError("invalid_request"); }
    const id = newId();
    try {
      await db.insert(oauthClients).values({ id, clientId: input.clientId, clientIdHash: hash(input.clientId), redirectUris: input.redirectUris, scopes: input.scopes });
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") throw new OAuthError("invalid_client");
      throw error;
    }
    return { id, clientId: input.clientId };
  }

  private readonly codeTtlMs: number;
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;

  readonly config: Readonly<OAuthConfig>;

  constructor(config: OAuthConfig) {
    this.config = Object.freeze({ ...config });
    this.codeTtlMs = config.codeTtlMs ?? 120_000;
    this.accessTtlMs = config.accessTtlMs ?? 600_000;
    this.refreshTtlMs = config.refreshTtlMs ?? 30 * 86_400_000;
    for (const [ttl, max] of [[this.codeTtlMs, 120_000], [this.accessTtlMs, 600_000], [this.refreshTtlMs, 30 * 86_400_000]] as const) {
      if (!Number.isSafeInteger(ttl) || ttl < 1000 || ttl > max) throw new Error("Invalid OAuth lifetime");
    }
    const issuer = secureUrl(config.issuer);
    if (config.issuer !== issuer.origin || config.resource !== `${issuer.origin}/mcp`) throw new Error("Noncanonical OAuth authority");
    secureUrl(config.resource);
  }
}
