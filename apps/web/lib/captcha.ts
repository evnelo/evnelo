import { env } from "./env";
import { captureError } from "./observability";
import { type CaptchaAction, type CaptchaProvider, type CaptchaPublicConfig } from "./captcha-shared";

export { CAPTCHA_FAILED_MESSAGE, CAPTCHA_FIELD } from "./captcha-shared";

/**
 * Bot check for the public forms that cost money or send mail on someone's behalf: sign-in links,
 * registrations, waitlist joins and abuse reports. Works with Cloudflare Turnstile (recommended:
 * free, invisible for almost everyone, no Google account) or Google reCAPTCHA v3. Off until the
 * three CAPTCHA_* variables are set, so development and tests never talk to a third party.
 */
export const captchaConfigured = Boolean(env.CAPTCHA_PROVIDER && env.CAPTCHA_SITE_KEY && env.CAPTCHA_SECRET_KEY);

/** What the browser needs: provider and public site key. `null` when the check is off. */
export function captchaPublicConfig(): CaptchaPublicConfig | null {
  return captchaConfigured ? { provider: env.CAPTCHA_PROVIDER!, siteKey: env.CAPTCHA_SITE_KEY! } : null;
}

export const CAPTCHA_VERIFY_URL: Record<CaptchaProvider, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  recaptcha: "https://www.google.com/recaptcha/api/siteverify",
};
/** reCAPTCHA v3 scores 0 (bot) to 1 (human); Google suggests 0.5 as the starting threshold. */
export const RECAPTCHA_MIN_SCORE = 0.5;
const VERIFY_TIMEOUT_MS = 6_000;

type SiteVerifyResponse = { success?: boolean; action?: string; score?: number; "error-codes"?: string[] };

/** Pure decision on a siteverify response: success, same action, and (reCAPTCHA) an acceptable score. */
export function captchaVerdict(provider: CaptchaProvider, response: unknown, action: CaptchaAction): boolean {
  const r = (response ?? {}) as SiteVerifyResponse;
  if (r.success !== true) return false;
  if (typeof r.action === "string" && r.action !== action) return false;
  if (provider === "recaptcha" && typeof r.score === "number" && r.score < RECAPTCHA_MIN_SCORE) return false;
  return true;
}

/**
 * Verifies a token from the form. Returns true when the check is not configured. A verification
 * outage counts as a failure (the user sees "reload and try again") rather than letting bots through.
 */
export async function verifyCaptcha(token: unknown, action: CaptchaAction, remoteIp?: string | null): Promise<boolean> {
  if (!captchaConfigured) return true;
  const provider = env.CAPTCHA_PROVIDER!;
  if (typeof token !== "string" || token.length === 0 || token.length > 4_096) return false;
  const body = new URLSearchParams({ secret: env.CAPTCHA_SECRET_KEY!, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const res = await fetch(CAPTCHA_VERIFY_URL[provider], { method: "POST", body, signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`siteverify responded ${res.status}`);
    return captchaVerdict(provider, await res.json(), action);
  } catch (e) {
    captureError("captcha.verify", e, { provider, action });
    return false;
  }
}
