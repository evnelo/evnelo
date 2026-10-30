import { describe, expect, it } from "vitest";
import { eventStructuredData, metaDescription, siteStructuredData } from "./seo";

const event = {
  name: "Launch night", descriptionMd: "## Doors at 6\n\nTalks, **demos** and [drinks](https://x.test).", startsAt: new Date("2026-11-05T21:00:00Z"), endsAt: new Date("2026-11-06T00:00:00Z"),
  status: "published" as const, locationType: "in_person", venueName: "The Hall", address: "1 Main St", city: "Lisbon", country: "PT", coverImageUrl: null,
};
const base = { event, organizer: { name: "Acme", url: "https://evnelo.com/o/acme" }, url: "https://evnelo.com/acme/launch", imageUrl: "https://evnelo.com/acme/launch/opengraph-image", soldOut: false };
const ticket = { priceMinor: 2500, currency: "EUR", quantity: 100, sold: 10, held: 2, salesStartAt: null };

describe("metaDescription", () => {
  it("turns markdown into one line of text", () => {
    expect(metaDescription(event.descriptionMd)).toBe("Doors at 6 Talks, demos and drinks.");
    expect(metaDescription("   ")).toBeUndefined();
    expect(metaDescription(null)).toBeUndefined();
  });

  it("cuts at a word boundary within the limit", () => {
    const text = "word ".repeat(60);
    const out = metaDescription(text, 50)!;
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith("word…")).toBe(true);
  });
});

describe("eventStructuredData", () => {
  it("describes an in-person event with its address, image fallback and offers", () => {
    const data = eventStructuredData({ ...base, ticketTypes: [ticket, { ...ticket, priceMinor: 0, quantity: 5, sold: 5 }] });
    expect(data.eventStatus).toBe("https://schema.org/EventScheduled");
    expect(data.eventAttendanceMode).toBe("https://schema.org/OfflineEventAttendanceMode");
    expect(data.location).toMatchObject({ "@type": "Place", name: "The Hall", address: { addressLocality: "Lisbon", addressCountry: "PT" } });
    expect(data.image).toEqual([base.imageUrl]);
    expect(data.offers.map((o) => [o.price, o.availability])).toEqual([["25.00", "https://schema.org/InStock"], ["0.00", "https://schema.org/SoldOut"]]);
    expect(data.organizer).toEqual({ "@type": "Organization", name: "Acme", url: "https://evnelo.com/o/acme" });
  });

  it("marks cancelled, online, hybrid and sold-out events", () => {
    expect(eventStructuredData({ ...base, ticketTypes: [], event: { ...event, status: "cancelled" } }).eventStatus).toBe("https://schema.org/EventCancelled");
    expect(eventStructuredData({ ...base, ticketTypes: [], event: { ...event, locationType: "online" } }).location).toEqual({ "@type": "VirtualLocation", url: base.url });
    const hybrid = eventStructuredData({ ...base, ticketTypes: [], event: { ...event, locationType: "hybrid" } });
    expect(hybrid.eventAttendanceMode).toBe("https://schema.org/MixedEventAttendanceMode");
    expect(Array.isArray(hybrid.location)).toBe(true);
    expect(eventStructuredData({ ...base, soldOut: true, ticketTypes: [ticket] }).offers[0]?.availability).toBe("https://schema.org/SoldOut");
  });
});

describe("siteStructuredData", () => {
  it("names the site and links the organization", () => {
    const graph = siteStructuredData("https://evnelo.com", ["https://github.com/evnelo/evnelo"])["@graph"];
    expect(graph.map((n) => n["@type"])).toEqual(["Organization", "WebSite", "SoftwareApplication"]);
    expect(graph[0]).toMatchObject({ logo: "https://evnelo.com/apple-icon", sameAs: ["https://github.com/evnelo/evnelo"] });
  });
});
