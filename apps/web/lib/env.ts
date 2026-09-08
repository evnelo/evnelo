import { z } from "zod";

const schema = z.object({
  EDITION: z.enum(["self_hosted", "cloud"]).default("self_hosted"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
  VONAGE_API_KEY: z.string().optional(),
  VONAGE_API_SECRET: z.string().optional(),
  VONAGE_APPLICATION_ID: z.string().optional(),
  VONAGE_PRIVATE_KEY: z.string().optional(),
  VONAGE_FROM: z.string().default("OpenTicket"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("OpenTicket <tickets@example.com>"),
  // wallet passes (optional)
  APPLE_PASS_TYPE_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_PASS_CERT: z.string().optional(),
  APPLE_PASS_KEY: z.string().optional(),
  APPLE_PASS_KEY_PASSPHRASE: z.string().optional(),
  APPLE_WWDR_CERT: z.string().optional(),
  GOOGLE_WALLET_ISSUER_ID: z.string().optional(),
  GOOGLE_WALLET_SERVICE_ACCOUNT: z.string().optional(),
});

export const env = schema.parse(process.env);
export const smsAuthMode: "application" | "basic" | null =
  env.VONAGE_APPLICATION_ID && env.VONAGE_PRIVATE_KEY ? "application" : env.VONAGE_API_KEY && env.VONAGE_API_SECRET ? "basic" : null;
export const smsConfigured = smsAuthMode !== null;
export const emailConfigured = Boolean(env.RESEND_API_KEY);
export const appleWalletConfigured = Boolean(env.APPLE_PASS_TYPE_ID && env.APPLE_TEAM_ID && env.APPLE_PASS_CERT && env.APPLE_PASS_KEY && env.APPLE_WWDR_CERT);
export const googleWalletConfigured = Boolean(env.GOOGLE_WALLET_ISSUER_ID && env.GOOGLE_WALLET_SERVICE_ACCOUNT);
