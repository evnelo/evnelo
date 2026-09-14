import { describe, expect, it, vi } from "vitest";
import type { Event, Organization } from "@evnelo/db";

vi.mock("@/lib/env", () => ({ env: { APP_URL: "https://evnelo.test" } }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
import { buildIcs } from "./ics";
import { calendarEvent, orderCalendarPath, ticketCalendarPath } from "./calendar";

const event = {
  id: "ev_1", slug: "launch", name: "Launch night", descriptionMd: "Doors at 6.", status: "published", visibility: "public",
  startsAt: new Date("2026-10-01T18:00:00Z"), endsAt: new Date("2026-10-01T21:00:00Z"), timezone: "UTC",
  locationType: "hybrid", venueName: "The Hall", address: "1 Main St", city: "Lisbon", onlineUrl: "https://meet.test/launch",
} as unknown as Event;
const org = { slug: "inevent" } as Organization;
const s = { online: "Online" };

describe("calendarEvent", () => {
  it("public: event page as the link, no online url", () => {
    const e = calendarEvent(event, org, s);
    expect(e.url).toBe("https://evnelo.test/inevent/launch");
    expect(e.uid).toBe("ev_1@evnelo");
    expect(e.description).toBe("Doors at 6.\n\nhttps://evnelo.test/inevent/launch");
    expect(e.location).toBe("The Hall, 1 Main St, Lisbon");
  });

  it("ticket holder: the ticket link comes first, then the join link, and the uid differs per ticket", () => {
    const e = calendarEvent(event, org, s, { label: "Your ticket", link: "https://evnelo.test/t/tok1", onlineUrl: "https://meet.test/launch" });
    expect(e.url).toBe("https://evnelo.test/t/tok1");
    expect(e.uid).toBe("ev_1-tok1@evnelo");
    expect(e.description.split("\n\n")).toEqual(["Your ticket: https://evnelo.test/t/tok1", "https://meet.test/launch", "Doors at 6.", "https://evnelo.test/inevent/launch"]);
    const ics = buildIcs(e);
    expect(ics).toContain("URL:https://evnelo.test/t/tok1");
    expect(ics.replace(/\r\n /g, "")).toContain("DESCRIPTION:Your ticket: https://evnelo.test/t/tok1\\n\\nhttps://meet.test/launch");
  });

  it("online-only event uses the Online label as location", () => {
    expect(calendarEvent({ ...event, locationType: "online" } as Event, org, s).location).toBe("Online");
  });

  it("paths", () => {
    expect(ticketCalendarPath("tok1")).toBe("/t/tok1/calendar.ics");
    expect(orderCalendarPath("ord1")).toBe("/orders/ord1/calendar.ics");
  });
});
