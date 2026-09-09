import { and, eq } from "drizzle-orm";
import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from "next-auth/adapters";
import { accounts, sessions, users, verificationTokens, type Database } from "@ot/db";
import { newId } from "@ot/core";

/** Auth.js adapter over our own users/accounts/sessions/verification_tokens tables. */
export function drizzleAdapter(db: Database): Adapter {
  const toUser = (u: typeof users.$inferSelect): AdapterUser => ({ id: u.id, email: u.email, name: u.name, image: u.avatarUrl, emailVerified: u.emailVerifiedAt });
  const findUser = async (id: string) => { const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1); return u ? toUser(u) : null; };
  return {
    async createUser(user) {
      const id = newId();
      await db.insert(users).values({ id, email: user.email.toLowerCase(), name: user.name ?? null, avatarUrl: user.image ?? null, emailVerifiedAt: user.emailVerified ?? null });
      return (await findUser(id))!;
    },
    getUser: findUser,
    async getUserByEmail(email) {
      const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      return u ? toUser(u) : null;
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const [row] = await db.select({ u: users }).from(accounts).innerJoin(users, eq(accounts.userId, users.id))
        .where(and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId))).limit(1);
      return row ? toUser(row.u) : null;
    },
    async updateUser(user) {
      await db.update(users).set({
        ...(user.email ? { email: user.email.toLowerCase() } : {}),
        ...(user.name !== undefined ? { name: user.name } : {}),
        ...(user.image !== undefined ? { avatarUrl: user.image } : {}),
        ...(user.emailVerified !== undefined ? { emailVerifiedAt: user.emailVerified } : {}),
      }).where(eq(users.id, user.id));
      return (await findUser(user.id))!;
    },
    async deleteUser(id) { await db.delete(users).where(eq(users.id, id)); },
    async linkAccount(a) {
      await db.insert(accounts).values({
        id: newId(), userId: a.userId, type: a.type, provider: a.provider, providerAccountId: a.providerAccountId,
        refreshToken: a.refresh_token ?? null, accessToken: a.access_token ?? null, expiresAt: a.expires_at ?? null,
        tokenType: a.token_type ?? null, scope: a.scope ?? null, idToken: a.id_token ?? null,
      });
      return a as AdapterAccount;
    },
    async unlinkAccount({ provider, providerAccountId }) {
      await db.delete(accounts).where(and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId)));
    },
    async createSession(s) {
      await db.insert(sessions).values({ token: s.sessionToken, userId: s.userId, expiresAt: s.expires });
      return s;
    },
    async getSessionAndUser(sessionToken) {
      const [row] = await db.select({ s: sessions, u: users }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(eq(sessions.token, sessionToken)).limit(1);
      if (!row) return null;
      const session: AdapterSession = { sessionToken: row.s.token, userId: row.s.userId, expires: row.s.expiresAt };
      return { session, user: toUser(row.u) };
    },
    async updateSession(s) {
      if (s.expires) await db.update(sessions).set({ expiresAt: s.expires }).where(eq(sessions.token, s.sessionToken));
      const [row] = await db.select().from(sessions).where(eq(sessions.token, s.sessionToken)).limit(1);
      return row ? { sessionToken: row.token, userId: row.userId, expires: row.expiresAt } : null;
    },
    async deleteSession(sessionToken) { await db.delete(sessions).where(eq(sessions.token, sessionToken)); },
    async createVerificationToken(t) {
      await db.insert(verificationTokens).values({ identifier: t.identifier, token: t.token, expiresAt: t.expires });
      return t;
    },
    async useVerificationToken({ identifier, token }) {
      const [row] = await db.select().from(verificationTokens).where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token))).limit(1);
      if (!row) return null;
      await db.delete(verificationTokens).where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token)));
      const vt: VerificationToken = { identifier: row.identifier, token: row.token, expires: row.expiresAt };
      return vt;
    },
  };
}
