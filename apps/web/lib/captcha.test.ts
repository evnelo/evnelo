import { describe, expect, it } from "vitest";
import { captchaVerdict } from "./captcha";

describe("captcha verdict", () => {
  it("accepts a successful Turnstile response for the same action", () => {
    expect(captchaVerdict("turnstile", { success: true, action: "register" }, "register")).toBe(true);
    expect(captchaVerdict("turnstile", { success: true }, "register")).toBe(true);
  });

  it("rejects failures, other actions and reCAPTCHA scores below the threshold", () => {
    expect(captchaVerdict("turnstile", { success: false, "error-codes": ["timeout-or-duplicate"] }, "login")).toBe(false);
    expect(captchaVerdict("turnstile", { success: true, action: "login" }, "register")).toBe(false);
    expect(captchaVerdict("recaptcha", { success: true, action: "waitlist", score: 0.1 }, "waitlist")).toBe(false);
    expect(captchaVerdict("recaptcha", { success: true, action: "waitlist", score: 0.9 }, "waitlist")).toBe(true);
    expect(captchaVerdict("recaptcha", null, "report")).toBe(false);
    expect(captchaVerdict("recaptcha", "nonsense", "report")).toBe(false);
  });
});
