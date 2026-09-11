/** Types and constants shared by the server-side verifier and the client widget. No runtime deps. */
export type CaptchaProvider = "turnstile" | "recaptcha";
/** One action per protected form; the verifier rejects a token minted for a different one. */
export type CaptchaAction = "login" | "register" | "waitlist" | "report";
export type CaptchaPublicConfig = { provider: CaptchaProvider; siteKey: string };
/** Name of the hidden form field / JSON property that carries the token. */
export const CAPTCHA_FIELD = "captchaToken";
export const CAPTCHA_FAILED_MESSAGE = "We couldn't confirm you're not a bot. Reload the page and try again.";
