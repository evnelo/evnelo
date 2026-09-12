/**
 * HTTP security headers, applied per request by middleware.ts from the runtime environment (a
 * next.config `headers()` entry is evaluated at build time, which is wrong for a Docker image).
 * Pure: takes the relevant env values so it is unit testable.
 *
 * The CSP allows Stripe (Payment Element scripts, iframes and API), the S3 origin the browser posts
 * uploads to, and any https image (event covers are arbitrary URLs). Scripts still need
 * 'unsafe-inline' because Next.js inlines hydration data; nonces would need a middleware rewrite of
 * every page and are a follow-up.
 */

/**
 * @typedef {{ appUrl?: string; nodeEnv?: string; s3Endpoint?: string; s3Bucket?: string; s3Region?: string; captchaProvider?: string }} SecurityHeaderEnv
 */

const STRIPE_SCRIPTS = ["https://js.stripe.com", "https://*.js.stripe.com"];
const STRIPE_FRAMES = ["https://js.stripe.com", "https://*.js.stripe.com", "https://hooks.stripe.com"];
const STRIPE_CONNECT = ["https://api.stripe.com", "https://maybe.stripe.com", "https://*.stripe.com"];
/** Bot-check widgets (lib/captcha.ts): the script and the challenge iframe, per provider. */
const CAPTCHA_ORIGINS = {
  turnstile: { scripts: ["https://challenges.cloudflare.com"], frames: ["https://challenges.cloudflare.com"] },
  recaptcha: { scripts: ["https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/"], frames: ["https://www.google.com/recaptcha/", "https://recaptcha.google.com/recaptcha/"] },
};

/**
 * @param {SecurityHeaderEnv} env
 * @returns {{ scripts: string[]; frames: string[] }}
 */
function captchaOrigins(env) {
  return (env.captchaProvider && CAPTCHA_ORIGINS[/** @type {keyof typeof CAPTCHA_ORIGINS} */ (env.captchaProvider)]) || { scripts: [], frames: [] };
}

/**
 * Origins the browser uploads to directly (presigned POST), derived the same way lib/storage.ts builds them.
 * @param {SecurityHeaderEnv} env
 * @returns {string[]}
 */
function uploadOrigins(env) {
  if (env.s3Endpoint) {
    try { return [new URL(env.s3Endpoint).origin]; } catch { return []; }
  }
  if (!env.s3Bucket || !env.s3Region) return [];
  const origins = [`https://s3.${env.s3Region}.amazonaws.com`];
  if (!env.s3Bucket.includes(".")) origins.push(`https://${env.s3Bucket}.s3.${env.s3Region}.amazonaws.com`);
  return origins;
}

/**
 * @param {SecurityHeaderEnv} env
 * @returns {string}
 */
function contentSecurityPolicy(env) {
  const dev = env.nodeEnv !== "production";
  /** @type {Record<string, string[]>} */
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...STRIPE_SCRIPTS, ...captchaOrigins(env).scripts],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(dev ? ["ws:", "wss:"] : []), ...STRIPE_CONNECT, ...uploadOrigins(env)],
    "frame-src": [...STRIPE_FRAMES, ...captchaOrigins(env).frames],
    "worker-src": ["'self'", "blob:"],
    "media-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // sign-in with Google is a form POST that redirects to accounts.google.com; Chrome applies form-action to that redirect
    "form-action": ["'self'", "https://accounts.google.com"],
    "frame-ancestors": ["'none'"],
    ...(dev ? {} : { "upgrade-insecure-requests": [] }),
  };
  return Object.entries(directives).map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k)).join("; ");
}

/**
 * The interactive API reference loads Scalar from jsdelivr and lets people call the API from the page.
 * @returns {string}
 */
function apiDocsContentSecurityPolicy() {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.scalar.com https://cdn.jsdelivr.net",
    "img-src 'self' data: https:",
    "connect-src 'self' https://cdn.jsdelivr.net https://api.scalar.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * @param {SecurityHeaderEnv} env
 * @returns {{ key: string; value: string }[]}
 */
function securityHeaders(env) {
  const https = env.appUrl?.startsWith("https://") ?? false;
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(env) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // camera: check-in scanner; geolocation: "near me" discovery; payment: Apple/Google Pay inside the Stripe iframe
    { key: "Permissions-Policy", value: 'camera=(self), geolocation=(self), microphone=(), payment=(self "https://js.stripe.com"), usb=(), interest-cohort=()' },
    ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
  ];
}

/**
 * @param {NodeJS.ProcessEnv} [processEnv]
 * @returns {SecurityHeaderEnv}
 */
function securityHeadersFromProcessEnv(processEnv = process.env) {
  /** @param {string} k */
  const v = (k) => (processEnv[k]?.trim() ? processEnv[k]?.trim() : undefined);
  return { appUrl: v("APP_URL"), nodeEnv: processEnv.NODE_ENV, s3Endpoint: v("S3_ENDPOINT"), s3Bucket: v("S3_BUCKET"), s3Region: v("S3_REGION") ?? v("AWS_REGION"), captchaProvider: v("CAPTCHA_PROVIDER") };
}

module.exports = { uploadOrigins, captchaOrigins, contentSecurityPolicy, apiDocsContentSecurityPolicy, securityHeaders, securityHeadersFromProcessEnv };
