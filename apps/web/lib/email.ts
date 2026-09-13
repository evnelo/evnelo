import * as React from "react";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locales";
import { loadMessages } from "@/i18n/messages";
import type { EmailMessages, EmailTranslator } from "@/emails/layout";
import { env, emailConfigured } from "./env";

const resend = emailConfigured ? new Resend(env.RESEND_API_KEY) : null;

/** A stored locale (attendees.locale, waitlist_entries.locale) may be null or unknown: English then. */
export function emailLocale(stored: string | null | undefined): Locale {
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

/**
 * The i18n props every email template and subject helper takes, for a recipient's locale.
 * Works outside a React request (job loop), so it uses createTranslator + loadMessages
 * rather than getTranslations. Spread the result into the template props.
 */
export async function emailTranslator(locale: Locale): Promise<{ locale: Locale; t: EmailTranslator }> {
  const messages = (await loadMessages(locale)) as EmailMessages;
  return { locale, t: createTranslator({ locale, messages, namespace: "emails" }) };
}

export async function renderEmail(element: React.ReactElement) {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}

export async function sendEmail(args: { to: string; subject: string; html: string; text: string; replyTo?: string }) {
  if (!resend) throw new Error("RESEND_API_KEY is not set");
  const { data, error } = await resend.emails.send({ from: env.EMAIL_FROM, to: args.to, subject: args.subject, html: args.html, text: args.text, replyTo: args.replyTo });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { providerMessageId: data!.id };
}
