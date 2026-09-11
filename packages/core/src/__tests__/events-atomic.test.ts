import { describe, expect, it } from "vitest";
import { events, eventTags, tags, type Database, type Event } from "@evnelo/db";
import { createEvent, eventInput, updateEvent, type EventInput } from "../services/events";

const input: EventInput = {
  name: "Production API",
  timezone: "UTC",
  startsAt: new Date("2030-01-02T10:00:00.000Z"),
  endsAt: new Date("2030-01-02T11:00:00.000Z"),
  locationType: "online",
  visibility: "public",
  requiresApproval: false,
  waitlistEnabled: false,
  collectPhone: false,
  guestsEnabled: false,
  maxGuests: 1,
  feePassThrough: false,
  socialLinks: [],
  reminderHours: [24, 1],
  tags: [],
  hosts: [],
  sponsors: [],
};

describe("event URL validation", () => {
  it("accepts only well-formed HTTP and HTTPS URLs", () => {
    expect(eventInput.safeParse({ ...input, onlineUrl: "https://example.test/event" }).success).toBe(true);
    expect(eventInput.safeParse({ ...input, onlineUrl: "http://" }).success).toBe(false);
    expect(eventInput.safeParse({ ...input, onlineUrl: "ftp://example.test/event" }).success).toBe(false);
    expect(eventInput.parse({ ...input, onlineUrl: "" }).onlineUrl).toBeNull();
  });
});

describe("event creation transactions", () => {
  it("performs every event creation write inside one transaction", async () => {
    const calls: string[] = [];
    const event = { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", organizationId: "org-id", slug: "production-api" } as Event;
    const tx = {
      insert: () => ({ values: async () => { calls.push("insert"); } }),
      delete: () => ({ where: async () => { calls.push("delete-relation"); } }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [event] }) }) }),
    };
    const db = {
      transaction: async (operation: (transaction: typeof tx) => Promise<Event>) => {
        calls.push("transaction");
        return operation(tx);
      },
    } as unknown as Database;

    await expect(createEvent(db, "org-id", input)).resolves.toBe(event);
    expect(calls[0]).toBe("transaction");
    expect(calls).toContain("insert");
  });

  it("deduplicates tags by their normalized slug", async () => {
    let eventTagWrites = 0;
    let selectCount = 0;
    const event = { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", organizationId: "org-id", slug: "production-api" } as Event;
    const tx = {
      insert: (table: unknown) => ({ values: () => {
        if (table === tags) return { onDuplicateKeyUpdate: async () => undefined };
        if (table === eventTags) eventTagWrites += 1;
        return Promise.resolve();
      } }),
      delete: () => ({ where: async () => undefined }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => {
        selectCount += 1;
        return selectCount === 1 ? [{ id: "tag-id" }] : [event];
      } }) }) }),
    };
    const db = {
      transaction: async (operation: (transaction: typeof tx) => Promise<Event>) => operation(tx),
    } as unknown as Database;

    await createEvent(db, "org-id", { ...input, tags: ["C++", "C#"] });
    expect(eventTagWrites).toBe(1);
  });

  it("retries event insertion when a concurrent request takes the slug", async () => {
    let eventInsertAttempts = 0;
    const event = { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", organizationId: "org-id", slug: "production-api-abcd" } as Event;
    const tx = {
      insert: (table: unknown) => ({ values: async () => {
        if (table !== events) return;
        eventInsertAttempts += 1;
        if (eventInsertAttempts === 1) throw Object.assign(new Error("duplicate slug"), { code: "ER_DUP_ENTRY" });
      } }),
      delete: () => ({ where: async () => undefined }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [event] }) }) }),
    };
    const db = {
      transaction: async (operation: (transaction: typeof tx) => Promise<Event>) => operation(tx),
    } as unknown as Database;

    await expect(createEvent(db, "org-id", input)).resolves.toBe(event);
    expect(eventInsertAttempts).toBe(2);
  });

  it("performs event updates and relation writes inside one transaction", async () => {
    const calls: string[] = [];
    const before = {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", organizationId: "org-id", slug: "production-api", status: "draft",
      startsAt: input.startsAt, endsAt: input.endsAt, timezone: input.timezone, locationType: input.locationType,
      venueName: null, address: null, city: null, onlineUrl: null,
    } as Event;
    const after = { ...before, name: "Updated production API" } as Event;
    let selectCount = 0;
    const tx = {
      update: () => ({ set: () => ({ where: async () => { calls.push("update"); } }) }),
      insert: () => ({ values: async () => undefined }),
      delete: () => ({ where: async () => { calls.push("delete-relation"); } }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => {
        selectCount += 1;
        return [selectCount === 1 ? before : after];
      } }) }) }),
    };
    const db = {
      transaction: async (operation: (transaction: typeof tx) => Promise<unknown>) => {
        calls.push("transaction");
        return operation(tx);
      },
    } as unknown as Database;

    await updateEvent(db, before.id, { ...input, name: "Updated production API" });
    expect(calls[0]).toBe("transaction");
    expect(calls).toContain("update");
  });

  it("upserts tags so concurrent creation cannot fail on the unique slug", async () => {
    let tagUpserts = 0;
    let eventTagWrites = 0;
    let selectCount = 0;
    const event = { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", organizationId: "org-id", slug: "production-api" } as Event;
    const tx = {
      insert: (table: unknown) => ({ values: () => {
        if (table === tags) return { onDuplicateKeyUpdate: async () => { tagUpserts += 1; } };
        if (table === eventTags) eventTagWrites += 1;
        return Promise.resolve();
      } }),
      delete: () => ({ where: async () => undefined }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => {
        selectCount += 1;
        return selectCount === 1 ? [{ id: "tag-id" }] : [event];
      } }) }) }),
    };
    const db = {
      transaction: async (operation: (transaction: typeof tx) => Promise<Event>) => operation(tx),
    } as unknown as Database;

    await createEvent(db, "org-id", { ...input, tags: ["API"] });
    expect(tagUpserts).toBe(1);
    expect(eventTagWrites).toBe(1);
  });

  it("retries an event update when a concurrent request takes the requested slug", async () => {
    let updateAttempts = 0;
    let selectCount = 0;
    const before = {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", organizationId: "org-id", slug: "old-slug", status: "draft",
      startsAt: input.startsAt, endsAt: input.endsAt, timezone: input.timezone, locationType: input.locationType,
      venueName: null, address: null, city: null, onlineUrl: null,
    } as Event;
    const after = { ...before, slug: "requested-slug-abcd" } as Event;
    const tx = {
      update: () => ({ set: () => ({ where: async () => {
        updateAttempts += 1;
        if (updateAttempts === 1) throw Object.assign(new Error("duplicate slug"), { code: "ER_DUP_ENTRY" });
      } }) }),
      insert: () => ({ values: async () => undefined }),
      delete: () => ({ where: async () => undefined }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => {
        selectCount += 1;
        return [selectCount === 1 ? before : after];
      } }) }) }),
    };
    const db = {
      transaction: async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
    } as unknown as Database;

    await expect(updateEvent(db, before.id, { ...input, slug: "requested-slug" })).resolves.toMatchObject({ event: after });
    expect(updateAttempts).toBe(2);
  });
});
