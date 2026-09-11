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
  VONAGE_FROM: z.string().default("Evnelo"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(), // whsec_… from Resend → Webhooks, verifies delivery events
  EMAIL_FROM: z.string().default("Evnelo <tickets@evnelo.com>"),
  VONAGE_SIGNATURE_SECRET: z.string().optional(), // dashboard → Settings → signature secret; verifies status/inbound webhooks
  JOBS_INLINE: z.enum(["true", "false"]).default("true"), // run the notification loop inside the web process
  MIGRATE_ON_START: z.enum(["true", "false"]).default("false"), // apply pending migrations when the server boots (Docker default: true)
  DB_MIGRATIONS_DIR: z.string().optional(),
  // address autocomplete: "photon" (komoot's public OSM instance, no key; addresses are sent to a third party),
  // "mapbox" (needs MAPBOX_TOKEN), or "none"
  GEOCODER: z.enum(["photon", "mapbox", "none"]).default("photon"),
  PHOTON_URL: z.string().url().default("https://photon.komoot.io"),
  MAPBOX_TOKEN: z.string().optional(),
  // which proxy header carries the real client IP; unset = clients are not told apart (only global limits)
  API_TRUSTED_PROXY_HEADER: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() || undefined : v), z.enum(["cf-connecting-ip", "x-real-ip", "x-forwarded-for"]).optional()),
  // image storage: direct-to-S3 uploads (or any S3-compatible bucket via S3_ENDPOINT); CloudFront rewrites public URLs.
  // Credentials/region are read from S3_* first, then the SDK-standard AWS_* names.
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  // every object key lives under this folder, so one bucket can be shared with other apps
  S3_KEY_PREFIX: z.string().default("openticket"),
  // "public-read" for buckets that still use object ACLs (no public bucket policy / CloudFront OAC);
  // leave unset for buckets with ACLs disabled, where sending an ACL makes the upload fail
  S3_UPLOAD_ACL: z.enum(["public-read"]).optional(),
  CLOUDFRONT_DOMAIN: z.string().optional(),
  // error reporting (optional): server DSN is read at runtime; the browser DSN (NEXT_PUBLIC_SENTRY_DSN) is inlined at build time
  ABUSE_EMAIL: z.string().email().optional(), // abuse reports from public event pages are emailed here when set
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
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
const building = process.env.NEXT_PHASE === "phase-production-build"; // `next build` loads page modules with NODE_ENV=production and no deployment env
if (process.env.NODE_ENV === "production" && !building && !process.env.APP_URL) throw new Error("APP_URL must be set in production (it anchors sign-in links and payment return URLs).");
process.env.AUTH_URL ??= env.APP_URL;
export const smsAuthMode: "application" | "basic" | null =
  env.VONAGE_APPLICATION_ID && env.VONAGE_PRIVATE_KEY ? "application" : env.VONAGE_API_KEY && env.VONAGE_API_SECRET ? "basic" : null;
export const smsConfigured = smsAuthMode !== null;
export const emailConfigured = Boolean(env.RESEND_API_KEY);
export const appleWalletConfigured = Boolean(env.APPLE_PASS_TYPE_ID && env.APPLE_TEAM_ID && env.APPLE_PASS_CERT && env.APPLE_PASS_KEY && env.APPLE_WWDR_CERT);
export const googleWalletConfigured = Boolean(env.GOOGLE_WALLET_ISSUER_ID && env.GOOGLE_WALLET_SERVICE_ACCOUNT);
