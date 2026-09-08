/**
 * Development seed: one demo organization with a free event (custom fields +
 * conditional logic), a paid event with two ticket types, a private event and a
 * draft. Idempotent: skips if the demo org already exists.
 *
 *   pnpm db:seed
 */
import { ulid } from "ulid";
import { eq } from "drizzle-orm";
import { loadRootEnv } from "./env";
import { createDb } from "./index";
import {
  events, eventHosts, eventSponsors, eventTags, organizations, registrationFields, tags, ticketTypes,
} from "./schema";

loadRootEnv();
const db = createDb();

const days = (n: number, hour = 18) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

const [existing] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, "demo")).limit(1);
if (existing) {
  console.log("seed: demo org already exists, nothing to do");
  process.exit(0);
}

const orgId = ulid();
await db.insert(organizations).values({
  id: orgId, slug: "demo", name: "Demo Collective", website: "https://example.com",
  socialLinks: [{ platform: "x", url: "https://x.com/example" }],
});

const tagRows = [
  { id: ulid(), slug: "design", name: "Design", curated: true },
  { id: ulid(), slug: "engineering", name: "Engineering", curated: true },
  { id: ulid(), slug: "payments", name: "Payments", curated: false },
];
await db.insert(tags).values(tagRows);
const tagId = (slug: string) => tagRows.find((t) => t.slug === slug)!.id;

/* ---- free, public, in person, with custom fields ---- */
const freeId = ulid();
await db.insert(events).values({
  id: freeId, organizationId: orgId, slug: "design-systems-meetup", name: "Design Systems Meetup, September edition",
  descriptionMd: "An evening of short talks on tokens, theming and component APIs.\n\nDoors at 6pm, talks start 6:30pm. Pizza and drinks provided.",
  coverImageUrl: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1600",
  timezone: "America/Sao_Paulo", startsAt: days(14, 21), endsAt: days(14, 24),
  locationType: "in_person", venueName: "Casa Cultural", address: "Rua Augusta 1500", city: "São Paulo", country: "BR",
  lat: "-23.5578", lng: "-46.6606",
  visibility: "public", status: "published", publishedAt: new Date(), capacity: 80, collectPhone: true,
  socialLinks: [{ platform: "website", url: "https://example.com/meetup" }, { platform: "discord", url: "https://discord.gg/example" }],
});
await db.insert(ticketTypes).values({ id: ulid(), eventId: freeId, name: "General admission", priceMinor: 0, currency: "BRL", quantity: 80 });
await db.insert(eventHosts).values([
  { id: ulid(), eventId: freeId, name: "Ana Souza", title: "Design lead", position: 0, socialLinks: [{ platform: "linkedin", url: "https://linkedin.com/in/example" }] },
  { id: ulid(), eventId: freeId, name: "Rafael Lima", title: "Frontend engineer", position: 1 },
]);
await db.insert(eventSponsors).values([
  { id: ulid(), eventId: freeId, name: "Acme Fonts", tier: "Gold", website: "https://example.com", position: 0 },
  { id: ulid(), eventId: freeId, name: "Grid Co", tier: "Community", website: "https://example.com", position: 1 },
]);
await db.insert(eventTags).values([{ eventId: freeId, tagId: tagId("design") }, { eventId: freeId, tagId: tagId("engineering") }]);
await db.insert(registrationFields).values([
  { id: ulid(), eventId: freeId, key: "role", label: "What do you do?", type: "select", required: true, scope: "attendee", position: 0,
    options: [{ value: "design", label: "Design" }, { value: "eng", label: "Engineering" }, { value: "other", label: "Something else" }] },
  { id: ulid(), eventId: freeId, key: "role_other", label: "Tell us more", type: "short_text", required: true, scope: "attendee", position: 1,
    condition: { op: "and", rules: [{ fieldKey: "role", op: "eq", value: "other" }] } },
  { id: ulid(), eventId: freeId, key: "diet", label: "Dietary needs", type: "multi_select", required: false, scope: "attendee", position: 2,
    options: [{ value: "veg", label: "Vegetarian" }, { value: "vegan", label: "Vegan" }, { value: "gf", label: "Gluten-free" }] },
  { id: ulid(), eventId: freeId, key: "code_of_conduct", label: "I agree to the code of conduct", type: "consent", required: true, scope: "order", position: 3 },
]);

/* ---- paid, public, online, two ticket types ---- */
const paidId = ulid();
await db.insert(events).values({
  id: paidId, organizationId: orgId, slug: "payments-workshop", name: "Workshop: ship a payment flow in a day",
  descriptionMd: "Hands-on, remote workshop. Bring a laptop and a Stripe test account.",
  coverImageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1600",
  timezone: "America/New_York", startsAt: days(21, 14), endsAt: days(21, 18),
  locationType: "online", onlineUrl: "https://meet.example.com/workshop",
  visibility: "public", status: "published", publishedAt: new Date(), feePassThrough: true,
  refundPolicy: "Full refund up to 48 hours before the workshop.",
});
await db.insert(ticketTypes).values([
  { id: ulid(), eventId: paidId, name: "Early bird", priceMinor: 2500, currency: "USD", quantity: 20, position: 0, salesEndAt: days(10) },
  { id: ulid(), eventId: paidId, name: "Standard", priceMinor: 4000, currency: "USD", quantity: 50, position: 1, taxRateBps: 800 },
]);
await db.insert(eventTags).values([{ eventId: paidId, tagId: tagId("payments") }, { eventId: paidId, tagId: tagId("engineering") }]);

/* ---- private (invite only) and draft: must not appear on /discover ---- */
await db.insert(events).values([
  { id: ulid(), organizationId: orgId, slug: "founders-dinner", name: "Founders dinner", timezone: "Europe/Lisbon",
    startsAt: days(30, 19), endsAt: days(30, 22), locationType: "in_person", city: "Lisbon", country: "PT",
    visibility: "private", status: "published", publishedAt: new Date() },
  { id: ulid(), organizationId: orgId, slug: "unfinished-event", name: "Unfinished event", timezone: "UTC",
    startsAt: days(40), endsAt: days(40, 20), visibility: "public", status: "draft" },
]);

console.log("seed: created org demo with 4 events");
process.exit(0);
