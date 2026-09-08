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
  VONAGE_FROM: z.string().default("OpenTicket"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("OpenTicket <tickets@example.com>"),
});

export const env = schema.parse(process.env);
export const smsConfigured = Boolean(env.VONAGE_API_KEY && env.VONAGE_API_SECRET);
export const emailConfigured = Boolean(env.RESEND_API_KEY);
