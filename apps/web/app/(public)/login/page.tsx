import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { MailCheck, Percent, QrCode, Ticket } from "lucide-react";
import { auth, googleEnabled, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/ui/form-field";
import { safeNextPath } from "@/lib/auth/session";
import { clientAddressFromHeaders } from "@/lib/api-http";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { CAPTCHA_FAILED_MESSAGE, CAPTCHA_FIELD, verifyCaptcha } from "@/lib/captcha";
import { CaptchaField } from "@/components/captcha";

export const metadata = { title: "Sign in", robots: "noindex" };

const errorText: Record<string, string> = {
  Verification: "That sign-in link has expired or was already used. Request a new one.",
  AccessDenied: "You can't sign in with that account.",
  Configuration: "Sign-in isn't configured on this instance yet. Check RESEND_API_KEY.",
  RateLimited: "Too many sign-in links requested. Wait 15 minutes and try again.",
  Captcha: CAPTCHA_FAILED_MESSAGE,
  EmailSignin: "We couldn't send the sign-in email. Try again in a minute.",
  InvalidEmail: "Enter a valid email address.",
  Default: "Something went wrong signing you in. Try again.",
};

const REASONS = [
  { icon: Ticket, text: "Free events are free to run." },
  { icon: Percent, text: "Paid events cost the host 0.99%." },
  { icon: QrCode, text: "QR tickets, wallet passes and door check-in included." },
];

/** A decorative ticket for the side panel. Purely illustrative, so it is hidden from assistive tech. */
function TicketIllustration() {
  const cells = [1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1];
  return (
    <div aria-hidden className="ticket grid w-full max-w-sm -rotate-2 grid-cols-[minmax(0,1fr)_6rem]" style={{ ["--background" as string]: "var(--muted)" }}>
      <div className="p-6">
        <div className="date-leaf border-[color:var(--ticket-perforation)]" style={{ ["--accent-event" as string]: "var(--ticket-ink)", ["--accent-event-foreground" as string]: "var(--ticket-paper)" }}>
          <span>Oct</span><span>15</span>
        </div>
        <p className="display mt-5 text-2xl">Product Night</p>
        <p className="mt-1 text-xs opacity-70">Thursday, 7:00 PM · Cubo Itaú</p>
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] opacity-55">Admit one</p>
      </div>
      <div className="ticket-stub flex items-center justify-center p-4">
        <div className="grid size-16 grid-cols-5 gap-0.5 rounded bg-white p-1.5">
          {cells.map((on, i) => <span key={i} className={on ? "rounded-[1px] bg-[var(--ticket-ink)]" : ""} />)}
        </div>
      </div>
    </div>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; sent?: string; error?: string; email?: string }> }) {
  const { next, sent, error, email } = await searchParams;
  const redirectTo = safeNextPath(next);
  if (await auth()) redirect(redirectTo);

  async function sendLink(formData: FormData) {
    "use server";
    const address = String(formData.get("email") ?? "").trim().toLowerCase();
    const to = safeNextPath(String(formData.get("next") ?? ""));
    const back = to !== "/dashboard" ? `&next=${encodeURIComponent(to)}` : "";
    if (!z.string().email().max(254).safeParse(address).success) redirect(`/login?error=InvalidEmail${back}`);
    // Each link is an email we pay for and a token that stays valid for 15 minutes: cap requests
    // per address, and per client when a trusted proxy header identifies one.
    const client = clientAddressFromHeaders(await headers());
    const allowed = await Promise.all([
      consumeSharedRateLimit("login:email", address, 3, 15 * 60_000),
      client ? consumeSharedRateLimit("login:client", client, 10, 15 * 60_000) : true,
    ]);
    if (allowed.includes(false)) redirect(`/login?error=RateLimited&email=${encodeURIComponent(address)}${back}`);
    if (!(await verifyCaptcha(formData.get(CAPTCHA_FIELD), "login", client))) redirect(`/login?error=Captcha&email=${encodeURIComponent(address)}${back}`);
    try {
      // with redirect:false Auth.js reports a failed send as an error URL instead of throwing
      const result: unknown = await signIn("resend", { email: address, redirectTo: to, redirect: false });
      if (typeof result === "string" && /[?&]error=/.test(result)) redirect(`/login?error=EmailSignin&email=${encodeURIComponent(address)}${back}`);
    } catch (e) {
      if (e instanceof AuthError) redirect(`/login?error=${e.type}`);
      throw e;
    }
    redirect(`/login?sent=1&email=${encodeURIComponent(address)}${to !== "/dashboard" ? `&next=${encodeURIComponent(to)}` : ""}`);
  }
  async function google() {
    "use server";
    await signIn("google", { redirectTo });
  }

  return (
    <div className="mx-auto grid max-w-6xl px-4 sm:px-6 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-2 lg:gap-12">
      <div className="flex items-center py-16 lg:py-20">
        <div className="animate-rise mx-auto w-full max-w-sm lg:mx-0">
          <p className="eyebrow">Hosts and teammates</p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">Sign in</h1>
          {sent ? (
            <div className="mt-8 rounded-xl border border-border/80 bg-card p-6 shadow-card">
              <div className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground"><MailCheck className="size-5" aria-hidden /></div>
              <p className="mt-4 font-medium">Check your email</p>
              <p className="mt-1 text-sm text-muted-foreground">We sent a sign-in link{email ? ` to ${email}` : ""}. It works once and expires in 15 minutes.</p>
              <p className="mt-5 text-sm"><a href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="underline underline-offset-4">Use a different email</a></p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <p className="text-sm text-muted-foreground">No password. We'll email you a link that signs you in, and create your account the first time.</p>
              {error && <FormMessage error={errorText[error] ?? errorText.Default} />}
              <form action={sendLink} className="space-y-3">
                <input type="hidden" name="next" value={redirectTo} />
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required autoComplete="email" autoFocus defaultValue={email} className="mt-1.5 h-11" />
                </div>
                <CaptchaField action="login" />
                <SubmitButton size="lg" className="w-full">Email me a sign-in link</SubmitButton>
              </form>
              {googleEnabled && (
                <>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="hairline flex-1" />or<span className="hairline flex-1" /></div>
                  <form action={google}><SubmitButton variant="outline" size="lg" className="w-full">Continue with Google</SubmitButton></form>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <aside className="my-8 hidden flex-col justify-center gap-12 rounded-2xl bg-muted px-12 py-16 lg:flex" aria-label="Why Evnelo">
        <TicketIllustration />
        <ul className="space-y-4">
          {REASONS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[15px]">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-card"><Icon className="size-4" aria-hidden /></span>
              {text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
