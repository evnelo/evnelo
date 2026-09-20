import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { test as base, type Page } from "@playwright/test";
import { createDb, verificationTokens } from "@evnelo/db";

// Loads the repo-root .env so a local run finds DATABASE_URL and AUTH_SECRET like the app does.
// Playwright compiles these files to CommonJS, hence __dirname rather than import.meta.
try { process.loadEnvFile(path.resolve(__dirname, "../../../.env")); } catch { /* CI injects env directly */ }

export const DEMO = {
  org: "demo",
  freeEvent: { slug: "design-systems-meetup", name: "Design Systems Meetup, September edition" },
  paidEvent: { slug: "payments-workshop", name: "Workshop: ship a payment flow in a day" },
};

export const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);

/** A unique address per test so runs never collide on "already registered" checks. */
export const uniqueEmail = (prefix: string) => `${prefix}-${randomBytes(6).toString("hex")}@e2e.evnelo.test`;

/**
 * Signs the page in as `email` without email delivery: inserts the verification token Auth.js
 * would have mailed (it stores sha256(token + AUTH_SECRET)) and opens the callback link. The
 * user row is created on first sign-in, exactly as with a real magic link.
 */
export async function signIn(page: Page, email: string, next = "/dashboard") {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to mint a sign-in link");
  const db = createDb(process.env.DATABASE_URL);
  const token = randomBytes(32).toString("hex");
  await db.insert(verificationTokens).values({ identifier: email, token: createHash("sha256").update(`${token}${secret}`).digest("hex"), expiresAt: new Date(Date.now() + 10 * 60_000) });
  const url = new URL("/api/auth/callback/resend", process.env.BASE_URL ?? "http://localhost:3000");
  url.searchParams.set("token", token);
  url.searchParams.set("email", email);
  url.searchParams.set("callbackUrl", next);
  await page.goto(url.toString());
}

export const test = base;
export { expect } from "@playwright/test";
