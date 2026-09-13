import { describe, expect, it } from "vitest";
import type { Event, TicketType } from "@evnelo/db";
import { eventInput } from "../services/events";
import { eventInputFromRecord, paginate, paginateAll, ticketTypeInputFromRecord } from "../services/listings";
import { ticketTypeInput } from "../services/tickets";

const now = new Date("2030-05-01T10:00:00.000Z");
const event: Event = {
  id: "01AAAAAAAAAAAAAAAAAAAAAAAA", organizationId: "01BBBBBBBBBBBBBBBBBBBBBBBB", slug: "launch", name: "Launch party", descriptionMd: null,
  coverImageUrl: null, timezone: "Europe/Lisbon", startsAt: now, endsAt: new Date(now.getTime() + 3_600_000),
  locationType: "in_person", venueName: "Loft", address: null, city: "Lisbon", country: "PT", lat: null, lng: null, onlineUrl: null,
  visibility: "public", status: "draft", requiresApproval: false, capacity: 120, waitlistEnabled: true, collectPhone: false,
  guestsEnabled: true, maxGuests: 2, feePassThrough: false, refundPolicy: null, socialLinks: [{ platform: "x", url: "https://x.com/evnelo" }],
  reminderHours: [24, 1], publishedAt: null, deletedAt: null, createdAt: now, updatedAt: now,
};

describe("PATCH support", () => {
  it("round-trips a stored event through eventInput so a patch can be merged on top", () => {
    const record = eventInputFromRecord({
      event, tags: [{ name: "Design", slug: "design" }],
      hosts: [{ name: "Ana", title: null, avatarUrl: null, socialLinks: [] }],
      sponsors: [{ name: "Acme", logoUrl: null, tier: "gold", website: "https://acme.test", socialLinks: [] }],
    });
    const unchanged = eventInput.safeParse(record);
    expect(unchanged.success).toBe(true);
    expect(unchanged.success && unchanged.data).toMatchObject({ slug: "launch", capacity: 120, country: "PT", tags: ["Design"], hosts: [{ name: "Ana" }], sponsors: [{ name: "Acme", tier: "gold" }] });

    const patched = eventInput.safeParse({ ...record, capacity: null, city: "Porto", tags: [] });
    expect(patched.success && patched.data).toMatchObject({ capacity: null, city: "Porto", tags: [], name: "Launch party" });
    expect(eventInput.safeParse({ ...record, endsAt: event.startsAt }).success).toBe(false);
  });

  it("round-trips a stored ticket type through ticketTypeInput", () => {
    const row: TicketType = {
      id: "01CCCCCCCCCCCCCCCCCCCCCCCC", eventId: event.id, name: "Early bird", description: null, priceMinor: 2500, currency: "EUR", quantity: 50,
      sold: 3, held: 1, minPerOrder: 1, maxPerOrder: 4, salesStartAt: null, salesEndAt: now, hidden: false, accessCode: null, taxRateBps: 2300, position: 0, createdAt: now, updatedAt: now,
    };
    const parsed = ticketTypeInput.safeParse(ticketTypeInputFromRecord(row));
    expect(parsed.success && parsed.data).toEqual({ name: "Early bird", description: null, priceMinor: 2500, currency: "EUR", quantity: 50, minPerOrder: 1, maxPerOrder: 4, salesStartAt: null, salesEndAt: now, hidden: false, accessCode: null, taxRateBps: 2300 });
    expect(ticketTypeInput.safeParse({ ...ticketTypeInputFromRecord(row), maxPerOrder: 0 }).success).toBe(false);
  });
});

describe("pagination", () => {
  it("cuts a limit+1 fetch into a page and the next offset", () => {
    expect(paginate([1, 2, 3], 2, 0)).toEqual({ data: [1, 2], pagination: { limit: 2, offset: 0, nextOffset: 2 } });
    expect(paginate([3], 2, 2)).toEqual({ data: [3], pagination: { limit: 2, offset: 2, nextOffset: null } });
    expect(paginate([], 2, 4)).toEqual({ data: [], pagination: { limit: 2, offset: 4, nextOffset: null } });
  });

  it("pages a whole list the same way", () => {
    const rows = ["a", "b", "c", "d", "e"];
    expect(paginateAll(rows, 2, 0)).toEqual({ data: ["a", "b"], pagination: { limit: 2, offset: 0, nextOffset: 2 } });
    expect(paginateAll(rows, 2, 4)).toEqual({ data: ["e"], pagination: { limit: 2, offset: 4, nextOffset: null } });
    expect(paginateAll(rows, 5, 0).pagination.nextOffset).toBeNull();
  });
});
