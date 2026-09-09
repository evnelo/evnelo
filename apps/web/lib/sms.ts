import { env, smsConfigured } from "./env";

export interface SmsProvider {
  send(to: string, text: string): Promise<{ providerMessageId: string }>;
}

/**
 * Telnyx Messaging API behind the SmsProvider interface. Plain fetch: one endpoint, one
 * bearer key, no SDK. `from` is an E.164 number owned in Telnyx or an alphanumeric sender
 * id (needs a messaging profile that allows it, and is not accepted by US carriers).
 */
class TelnyxSms implements SmsProvider {
  async send(to: string, text: string) {
    const res = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { authorization: `Bearer ${env.TELNYX_API_KEY}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        from: env.TELNYX_FROM,
        to,
        text,
        type: "SMS",
        ...(env.TELNYX_MESSAGING_PROFILE_ID ? { messaging_profile_id: env.TELNYX_MESSAGING_PROFILE_ID } : {}),
        // delivery-status webhook_url lands with the notification worker
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: { id?: string }; errors?: { title?: string; detail?: string }[] };
    if (!res.ok) throw new Error(`Telnyx ${res.status}: ${body.errors?.map((e) => e.detail ?? e.title).join("; ") ?? "unknown error"}`);
    return { providerMessageId: body.data?.id ?? "" };
  }
}

export const sms: SmsProvider | null = smsConfigured ? new TelnyxSms() : null;

/** Fixed transactional templates: variables only, no marketing copy. */
export const smsTemplates = {
  confirmation: (v: { event: string; ticketUrl: string }) => `You're in for ${v.event}. Your ticket: ${v.ticketUrl}`,
  reminder: (v: { event: string; when: string; ticketUrl: string }) => `${v.event} is ${v.when}. Ticket: ${v.ticketUrl}`,
  updated: (v: { event: string; url: string }) => `${v.event} has changed its time or venue. Details: ${v.url}`,
  cancelled: (v: { event: string }) => `${v.event} has been cancelled. Any payment will be refunded.`,
} as const;
