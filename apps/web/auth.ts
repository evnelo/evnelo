import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import * as React from "react";
import { db } from "@/lib/db";
import { emailConfigured, env } from "@/lib/env";
import { drizzleAdapter } from "@/lib/auth/adapter";
import { renderEmail, sendEmail } from "@/lib/email";
import MagicLink, { magicLinkSubject } from "@/emails/magic-link";

export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/**
 * Auth.js: magic-link email (via our Resend sender + React Email template) and Google when
 * configured. JWT sessions; users and OAuth accounts live in our own tables.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: drizzleAdapter(db),
  secret: env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 3600 },
  pages: { signIn: "/login", verifyRequest: "/login?sent=1", error: "/login" },
  providers: [
    Resend({
      apiKey: env.RESEND_API_KEY ?? "re_missing",
      from: env.EMAIL_FROM,
      maxAge: 15 * 60,
      async sendVerificationRequest({ identifier, url }) {
        const host = new URL(url).host;
        if (process.env.NODE_ENV !== "production") console.log(`[auth] magic link for ${identifier}: ${url}`);
        if (!emailConfigured) {
          if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set; magic-link sign-in needs email.");
          return; // dev without email: the link above is enough
        }
        const { html, text } = await renderEmail(React.createElement(MagicLink, { brand: { orgName: "Evnelo", appUrl: env.APP_URL }, url, host }));
        await sendEmail({ to: identifier, subject: magicLinkSubject({ brand: { orgName: "Evnelo", appUrl: env.APP_URL }, url, host }), html, text });
      },
    }),
    ...(googleEnabled ? [Google({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, allowDangerousEmailAccountLinking: true })] : []),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: { id: string; email?: string | null; name?: string | null; image?: string | null };
  }
}
