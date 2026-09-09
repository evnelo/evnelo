import { Vonage } from "@vonage/server-sdk";
import { Auth } from "@vonage/auth";
import { readFileSync } from "node:fs";
import { env, smsConfigured, smsAuthMode } from "./env";

export interface SmsProvider {
  send(to: string, text: string): Promise<{ providerMessageId: string }>;
}

/** PEM from env: inline (with "\n" escapes), base64-encoded, or a file path. */
function privateKeyPem(v: string) {
  if (v.includes("-----BEGIN")) return v.replace(/\\n/g, "\n");
  const decoded = Buffer.from(v, "base64").toString("utf8");
  if (decoded.includes("-----BEGIN")) return decoded;
  return readFileSync(v, "utf8");
}

/**
 * Vonage behind the SmsProvider interface. Vonage rewrites the sender to its own
 * pre-registered US pool, so no number registration is needed for US delivery.
 * Two auth styles: an Application ID + private key (Messages API, JWT auth, the current
 * Vonage default) or the legacy API key + secret (SMS API).
 */
class VonageSms implements SmsProvider {
  private client: Vonage;
  constructor() {
    this.client = new Vonage(
      smsAuthMode === "application"
        ? new Auth({ applicationId: env.VONAGE_APPLICATION_ID!, privateKey: privateKeyPem(env.VONAGE_PRIVATE_KEY!) })
        : new Auth({ apiKey: env.VONAGE_API_KEY!, apiSecret: env.VONAGE_API_SECRET! }),
    );
  }
  async send(to: string, text: string) {
    const dest = to.replace(/^\+/, "");
    if (smsAuthMode === "application") {
      const res = await this.client.messages.send({ channel: "sms", message_type: "text", to: dest, from: env.VONAGE_FROM, text } as any);
      return { providerMessageId: res.messageUUID ?? "" };
    }
    const res = await this.client.sms.send({ to: dest, from: env.VONAGE_FROM, text });
    const msg = res.messages[0];
    if (!msg || msg.status !== "0") throw new Error(`Vonage: ${msg?.errorText ?? "unknown error"}`);
    return { providerMessageId: msg.messageId ?? "" };
  }
}

export const sms: SmsProvider | null = smsConfigured ? new VonageSms() : null;

/** Fixed transactional templates: variables only, no marketing copy. */
export const smsTemplates = {
  confirmation: (v: { event: string; ticketUrl: string }) => `You're in for ${v.event}. Your ticket: ${v.ticketUrl}`,
  reminder: (v: { event: string; when: string; ticketUrl: string }) => `${v.event} is ${v.when}. Ticket: ${v.ticketUrl}`,
  updated: (v: { event: string; url: string }) => `${v.event} has changed its time or venue. Details: ${v.url}`,
  cancelled: (v: { event: string }) => `${v.event} has been cancelled. Any payment will be refunded.`,
} as const;
