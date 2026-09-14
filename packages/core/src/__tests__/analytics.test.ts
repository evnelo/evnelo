import { describe, expect, it } from "vitest";
import { dayRange, deviceFromUserAgent, organizationAnalyticsCsv, referrerHost, utmFromSearch, visitorHash } from "../services/analytics";

describe("visitorHash", () => {
  it("is stable within a day and changes with the day, the address and the browser", () => {
    const a = visitorHash("secret", "2026-09-14", "203.0.113.9", "Mozilla/5.0");
    expect(a).toHaveLength(64);
    expect(visitorHash("secret", "2026-09-14", "203.0.113.9", "Mozilla/5.0")).toBe(a);
    expect(visitorHash("secret", "2026-09-15", "203.0.113.9", "Mozilla/5.0")).not.toBe(a);
    expect(visitorHash("secret", "2026-09-14", "203.0.113.10", "Mozilla/5.0")).not.toBe(a);
    expect(visitorHash("secret", "2026-09-14", "203.0.113.9", "curl/8")).not.toBe(a);
    expect(visitorHash("other", "2026-09-14", "203.0.113.9", "Mozilla/5.0")).not.toBe(a);
  });
  it("never embeds the address", () => {
    expect(visitorHash("secret", "2026-09-14", "203.0.113.9", null)).not.toContain("203");
  });
});

describe("referrerHost", () => {
  it("keeps outside hosts, drops the app itself, direct traffic and junk", () => {
    expect(referrerHost("https://www.instagram.com/p/abc", "evnelo.com")).toBe("instagram.com");
    expect(referrerHost("https://evnelo.com/discover", "evnelo.com")).toBeNull();
    expect(referrerHost("https://www.evnelo.com/", "evnelo.com")).toBeNull();
    expect(referrerHost("", "evnelo.com")).toBeNull();
    expect(referrerHost("not a url", "evnelo.com")).toBeNull();
  });
});

describe("utmFromSearch and devices", () => {
  it("reads the utm parameters and caps their length", () => {
    expect(utmFromSearch("?utm_source=newsletter&utm_medium=email&utm_campaign=sept&x=1")).toEqual({ utmSource: "newsletter", utmMedium: "email", utmCampaign: "sept" });
    expect(utmFromSearch("").utmSource).toBeNull();
    expect(utmFromSearch(`?utm_source=${"a".repeat(300)}`).utmSource).toHaveLength(100);
  });
  it("tells phones from desktops", () => {
    expect(deviceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("desktop");
  });
});

describe("dayRange", () => {
  it("is inclusive of today and open-ended for all time", () => {
    const now = new Date("2026-09-14T12:00:00Z");
    expect(dayRange(7, now)).toEqual({ from: "2026-09-08", to: "2026-09-14" });
    expect(dayRange(null, now)).toEqual({ from: null, to: "2026-09-14" });
  });
});

describe("organizationAnalyticsCsv", () => {
  it("writes one line per event with quoted names and major-unit amounts", () => {
    const csv = organizationAnalyticsCsv({
      events: 1, registrations: 3, registrationsByDay: [], revenueByMonth: [], traffic: { visitors: 10, views: 12, registered: 3 }, doors: { checkedIn: 2, confirmed: 3 }, email: { sent: 3, delivered: 3, bounced: 0, failed: 0, opened: 1, clicked: 0 },
      topEvents: [{ id: "e1", name: 'Launch, "beta"', slug: "launch", startsAt: new Date("2026-10-01T18:00:00Z"), status: "published", registrations: 3, revenue: 1998, currency: "BRL", visitors: 10, checkedIn: 2 }],
    });
    expect(csv.split("\n")[0]).toBe("event,starts_at,status,registrations,visitors,revenue,currency,checked_in");
    expect(csv.split("\n")[1]).toBe('"Launch, ""beta""",2026-10-01T18:00:00.000Z,published,3,10,19.98,BRL,2');
  });
});
