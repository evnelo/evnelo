import { describe, expect, it } from "vitest";
import { serializeAttendee, serializeInvite, serializeOrganization, serializeWaitlistEntry, serializeWebhook } from "./api-serializers";

const now = new Date("2030-01-01T00:00:00.000Z");

describe("REST serializers", () => {
  it("never returns a webhook signing secret", () => {
    const out = serializeWebhook({ id: "w", organizationId: "o", url: "https://h.test", secret: "whsec_x", events: ["order.paid"], active: true, createdAt: now });
    expect(out).not.toHaveProperty("secret");
    expect(out).toMatchObject({ id: "w", url: "https://h.test", events: ["order.paid"] });
  });

  it("hides the waitlist claim token but reports the derived status", () => {
    const entry = { id: "e", eventId: "ev", ticketTypeId: "t", email: "a@x.test", locale: null, name: "A", token: "secret-token", promotedAt: now, holdExpiresAt: new Date(Date.now() + 3_600_000), expiredAt: null, registeredAt: null, orderId: null, createdAt: now };
    const out = serializeWaitlistEntry({ entry, ticketTypeName: "GA" });
    expect(out).not.toHaveProperty("token");
    expect(out).toMatchObject({ status: "offered", ticketTypeName: "GA" });
  });

  it("builds the invite link and status the dashboard shows", () => {
    const out = serializeInvite({ id: "i", eventId: "ev", email: null, token: "tok", maxUses: 1, uses: 1, expiresAt: null, createdAt: now });
    expect(out.url).toMatch(/\/i\/tok$/);
    expect(out.status).toBe("exhausted");
  });

  it("attaches the ticket link and check-in state to an attendee and drops internal org fields", () => {
    const attendee = { id: "a", eventId: "ev", orderId: "o", ticketTypeId: "t", userId: null, guestOfAttendeeId: null, name: "A", email: "a@x.test", locale: null, phone: null, smsOptIn: false, remindersOptOut: false, status: "confirmed" as const, answers: {}, deletedAt: null, createdAt: now, updatedAt: now };
    const out = serializeAttendee({ attendee, ticketId: "tk", ticketToken: "tok", ticketRevokedAt: null, checkedInAt: now, ticketTypeName: "GA", hostName: null, orderStatus: "paid", orderTotalMinor: 2500, orderCurrency: "USD" });
    expect(out.ticket).toMatchObject({ id: "tk", token: "tok", checkedInAt: now });
    expect(out.ticket?.url).toMatch(/\/t\/tok$/);
    expect(out.order).toEqual({ id: "o", status: "paid", totalMinor: 2500, currency: "USD" });
    expect(serializeAttendee({ attendee, ticketId: null, ticketToken: null, ticketRevokedAt: null, checkedInAt: null, ticketTypeName: "GA", hostName: null, orderStatus: "pending", orderTotalMinor: 0, orderCurrency: "USD" }).ticket).toBeNull();

    const org = serializeOrganization({ id: "o", slug: "demo", name: "Demo", logoUrl: null, website: null, accentColor: null, socialLinks: [], stripeAccountId: "acct_1", stripeAccountType: "standard", stripeChargesEnabled: true, feePassThrough: false, deletedAt: null, createdAt: now, updatedAt: now });
    expect(org).not.toHaveProperty("stripeAccountId");
    expect(org).toMatchObject({ slug: "demo", stripeChargesEnabled: true });
  });
});
