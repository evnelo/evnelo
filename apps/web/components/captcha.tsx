"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { CAPTCHA_FIELD, type CaptchaAction, type CaptchaPublicConfig } from "@/lib/captcha-shared";

const CaptchaContext = createContext<CaptchaPublicConfig | null>(null);

/** Put once in the root layout with `captchaPublicConfig()`; fields render nothing when it is null. */
export function CaptchaProvider({ config, children }: { config: CaptchaPublicConfig | null; children: React.ReactNode }) {
  return <CaptchaContext.Provider value={config}>{children}</CaptchaContext.Provider>;
}

type TurnstileOptions = { sitekey: string; action: string; execution: "execute"; appearance: "interaction-only"; callback: (token: string) => void; "error-callback": () => boolean; "expired-callback": () => void };
declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: TurnstileOptions) => string; execute: (id: string) => void; reset: (id: string) => void; remove: (id: string) => void };
    grecaptcha?: { ready: (cb: () => void) => void; execute: (siteKey: string, o: { action: string }) => Promise<string> };
  }
}

let scriptLoad: Promise<void> | null = null;
function loadScript(config: CaptchaPublicConfig) {
  if (config.provider === "turnstile" ? window.turnstile : window.grecaptcha) return Promise.resolve();
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = config.provider === "turnstile"
      ? "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      : `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(config.siteKey)}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptLoad = null; reject(new Error("captcha script failed to load")); };
    document.head.appendChild(s);
  });
  return scriptLoad;
}

const TOKEN_TIMEOUT_MS = 30_000;

/** Reads the token a `CaptchaField` stored in its form, for handlers that post JSON themselves. */
export function captchaTokenFrom(form: EventTarget | HTMLFormElement | null | undefined): string | undefined {
  const el = form instanceof HTMLFormElement ? form.elements.namedItem(CAPTCHA_FIELD) : null;
  return el instanceof HTMLInputElement && el.value ? el.value : undefined;
}

/**
 * Drop inside any `<form>`: a hidden `captchaToken` input plus the widget mount. On submit it
 * intercepts the event once, fetches a fresh token (invisible unless the provider asks the person
 * to interact), stores it in the hidden input and re-submits, so server actions read it from the
 * FormData and fetch-based handlers read it with `captchaTokenFrom(event.target)`. Tokens are
 * single-use, so every submission mints a new one. Renders nothing while CAPTCHA_* is unset.
 */
export function CaptchaField({ action, className }: { action: CaptchaAction; className?: string }) {
  const config = useContext(CaptchaContext);
  const input = useRef<HTMLInputElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const pending = useRef<((token: string | null) => void) | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (!config) return;
    const form = input.current?.form;
    if (!form) return;
    void loadScript(config).catch(() => {}); // warm the cache; failures surface on submit

    async function token(): Promise<string | null> {
      await loadScript(config!);
      if (config!.provider === "recaptcha") {
        return new Promise((resolve) => window.grecaptcha!.ready(() => window.grecaptcha!.execute(config!.siteKey, { action }).then(resolve, () => resolve(null))));
      }
      const ts = window.turnstile!;
      if (widget.current === null) {
        widget.current = ts.render(mount.current!, {
          sitekey: config!.siteKey, action, execution: "execute", appearance: "interaction-only",
          callback: (t) => pending.current?.(t),
          "error-callback": () => { pending.current?.(null); return true; },
          "expired-callback": () => pending.current?.(null),
        });
      } else {
        ts.reset(widget.current);
      }
      return new Promise((resolve) => {
        const timer = window.setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS);
        pending.current = (t) => { window.clearTimeout(timer); pending.current = null; resolve(t); };
        ts.execute(widget.current!);
      });
    }

    function onSubmit(e: SubmitEvent) {
      if (armed.current) { armed.current = false; return; }
      e.preventDefault();
      e.stopImmediatePropagation();
      const submitter = e.submitter instanceof HTMLElement ? e.submitter : undefined;
      // lock the buttons now; once re-submitted, the form's own pending state takes over
      const buttons = [...form!.querySelectorAll<HTMLButtonElement>('button[type="submit"]')].filter((b) => !b.disabled);
      for (const b of buttons) { b.disabled = true; b.setAttribute("aria-busy", "true"); }
      form!.setAttribute("aria-busy", "true");
      token().catch(() => null).then((t) => {
        if (input.current) input.current.value = t ?? "";
        form!.removeAttribute("aria-busy");
        for (const b of buttons) { b.disabled = false; b.removeAttribute("aria-busy"); }
        armed.current = true;
        form!.requestSubmit(submitter);
        armed.current = false;
      });
    }
    form.addEventListener("submit", onSubmit, true);
    return () => {
      form.removeEventListener("submit", onSubmit, true);
      if (widget.current !== null) { try { window.turnstile?.remove(widget.current); } catch {} widget.current = null; }
    };
  }, [config, action]);

  if (!config) return null;
  return (
    <>
      <input ref={input} type="hidden" name={CAPTCHA_FIELD} />
      <div ref={mount} className={className} />
      {config.provider === "recaptcha" && (
        <p className="text-xs text-muted-foreground">
          This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" className="underline underline-offset-2">Privacy Policy</a> and <a href="https://policies.google.com/terms" className="underline underline-offset-2">Terms of Service</a> apply.
        </p>
      )}
    </>
  );
}
