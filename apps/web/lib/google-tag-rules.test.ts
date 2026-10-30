import { describe, expect, it } from "vitest";
import { CONSENT_DENIED_REGIONS, googleTagAllowed, sanitizedLocation, sanitizedReferrer } from "./google-tag-rules";

describe("google tag rules", () => {
  it("tracks marketing pages and nothing that belongs to hosts, attendees or tokens", () => {
    for (const path of ["/", "/discover", "/login", "/legal", "/legal/privacy", "/pricing", "/brasil", "/compare/eventbrite"]) expect(googleTagAllowed(path)).toBe(true);
    for (const path of ["/acme/launch", "/o/acme", "/t/tok", "/orders/tok", "/i/tok", "/w/tok", "/invite/tok", "/unsubscribe/tok", "/onboarding", "/dashboard", "/legalese", "/pricing/x", "/compare"]) {
      expect(googleTagAllowed(path)).toBe(false);
    }
  });

  it("keeps campaign parameters and Discover facets, drops everything else", () => {
    expect(sanitizedLocation("https://evnelo.com/login?error=Captcha&email=a%40x.com&utm_source=google&gclid=abc#top"))
      .toBe("https://evnelo.com/login?utm_source=google&gclid=abc");
    expect(sanitizedLocation("https://evnelo.com/discover?q=my+name&city=Lisbon&lat=1&lng=2&price=free")).toBe("https://evnelo.com/discover?city=Lisbon&price=free");
    expect(sanitizedLocation("https://evnelo.com/")).toBe("https://evnelo.com/");
  });

  it("never passes a token page on as the referrer", () => {
    const origin = "https://evnelo.com";
    expect(sanitizedReferrer("https://evnelo.com/orders/secret-token", origin)).toBe("https://evnelo.com/");
    expect(sanitizedReferrer("https://evnelo.com/discover?q=x&city=Rio", origin)).toBe("https://evnelo.com/discover?city=Rio");
    expect(sanitizedReferrer("https://news.example.com/article?id=1", origin)).toBe("https://news.example.com/");
    expect(sanitizedReferrer("", origin)).toBe("");
    expect(sanitizedReferrer("not a url", origin)).toBe("");
  });

  it("denies storage across the EEA, the UK and Switzerland", () => {
    expect(CONSENT_DENIED_REGIONS).toHaveLength(32);
    expect(CONSENT_DENIED_REGIONS).toEqual(expect.arrayContaining(["DE", "FR", "NO", "IS", "LI", "GB", "CH"]));
    expect(CONSENT_DENIED_REGIONS).not.toContain("US");
  });
});
