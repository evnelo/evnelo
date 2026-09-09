import * as React from "react";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { env, emailConfigured } from "./env";

const resend = emailConfigured ? new Resend(env.RESEND_API_KEY) : null;

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
