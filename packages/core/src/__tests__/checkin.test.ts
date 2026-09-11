import { describe, expect, it } from "vitest";
import { fromDbDatetime, parseTicketToken } from "../services/checkin";

describe("parseTicketToken", () => {
  const token = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_";
  it("accepts a raw token, the ticket URL, and URLs with a trailing path or query", () => {
    expect(parseTicketToken(token)).toBe(token);
    expect(parseTicketToken(`https://tickets.example.com/t/${token}`)).toBe(token);
    expect(parseTicketToken(`https://tickets.example.com/t/${token}/wallet/apple`)).toBe(token);
    expect(parseTicketToken(`  https://tickets.example.com/t/${token}?utm=x  `)).toBe(token);
  });
  it("rejects anything that is not a ticket reference", () => {
    expect(parseTicketToken("")).toBeNull();
    expect(parseTicketToken("https://example.com/events/123")).toBeNull();
    expect(parseTicketToken("short")).toBeNull();
    expect(parseTicketToken("has spaces in it and is long enough")).toBeNull();
  });

  it("maps raw DATETIME strings from the driver as UTC", () => {
    expect(fromDbDatetime("2026-09-11 01:09:23.843")?.toISOString()).toBe("2026-09-11T01:09:23.843Z");
    expect(fromDbDatetime(null)).toBeNull();
    const d = new Date(); expect(fromDbDatetime(d)).toBe(d);
  });
});
