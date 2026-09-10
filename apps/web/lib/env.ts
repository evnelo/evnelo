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
  RESEND_WEBHOOK_SECRET: z.string().optional(), // whsec_… from Resend → Webhooks, verifies delivery events
  EMAIL_FROM: z.string().default("OpenTicket <tickets@example.com>"),
  VONAGE_SIGNATURE_SECRET: z.string().optional(), // dashboard → Settings → signature secret; verifies status/inbound webhooks
  JOBS_INLINE: z.enum(["true", "false"]).default("true"), // run the notification loop inside the web process
  // address autocomplete: "photon" (komoot's public OSM instance, no key; addresses are sent to a third party),
  // "mapbox" (needs MAPBOX_TOKEN), or "none"
  GEOCODER: z.enum(["photon", "mapbox", "none"]).default("photon"),
  PHOTON_URL: z.string().url().default("https://photon.komoot.io"),
  MAPBOX_TOKEN: z.string().optional(),
  // which proxy header carries the real client IP; unset = clients are not told apart (only global limits)
  API_TRUSTED_PROXY_HEADER: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() || undefined : v), z.enum(["cf-connecting-ip", "x-real-ip", "x-forwarded-for"]).optional()),
  // image storage: direct-to-S3 uploads (or any S3-compatible bucket via S3_ENDPOINT); CloudFront rewrites public URLs
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  CLOUDFRONT_DOMAIN: z.string().optional(),
  // Google sign-in (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
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

// .env files often carry `KEY=` placeholders: treat empty values as unset so optional URLs/enums validate.
export const env = schema.parse(Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v])));
// Auth.js derives magic-link and callback URLs from the request host unless AUTH_URL is set; in
// production that must come from the operator, never from an attacker-controlled Host header.
if (process.env.NODE_ENV === "production" && !process.env.APP_URL) throw new Error("APP_URL must be set in production (it anchors sign-in links and payment return URLs).");
process.env.AUTH_URL ??= env.APP_URL;
export const smsAuthMode: "application" | "basic" | null =
  env.VONAGE_APPLICATION_ID && env.VONAGE_PRIVATE_KEY ? "application" : env.VONAGE_API_KEY && env.VONAGE_API_SECRET ? "basic" : null;
export const smsConfigured = smsAuthMode !== null;
export const emailConfigured = Boolean(env.RESEND_API_KEY);
export const appleWalletConfigured = Boolean(env.APPLE_PASS_TYPE_ID && env.APPLE_TEAM_ID && env.APPLE_PASS_CERT && env.APPLE_PASS_KEY && env.APPLE_WWDR_CERT);
export const googleWalletConfigured = Boolean(env.GOOGLE_WALLET_ISSUER_ID && env.GOOGLE_WALLET_SERVICE_ACCOUNT);
