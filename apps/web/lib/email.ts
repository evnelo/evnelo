import { Resend } from "resend";
import { env, emailConfigured } from "./env";

const resend = emailConfigured ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail(args: { to: string; subject: string; html: string; text: string }) {
  if (!resend) throw new Error("RESEND_API_KEY is not set");
  const { data, error } = await resend.emails.send({ from: env.EMAIL_FROM, ...args });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { providerMessageId: data!.id };
}
