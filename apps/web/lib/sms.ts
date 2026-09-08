import { Vonage } from "@vonage/server-sdk";
import { Auth } from "@vonage/auth";
import { env, smsConfigured } from "./env";

export interface SmsProvider {
  send(to: string, text: string): Promise<{ providerMessageId: string }>;
}

class VonageSms implements SmsProvider {
  private client = new Vonage(new Auth({ apiKey: env.VONAGE_API_KEY!, apiSecret: env.VONAGE_API_SECRET! }));
  async send(to: string, text: string) {
    const res = await this.client.sms.send({ to: to.replace(/^\+/, ""), from: env.VONAGE_FROM, text });
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
