import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  datetime,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/* ---------- shared column helpers ---------- */

// ids are 26-char ULIDs generated in the service layer
const id = () => char("id", { length: 26 }).primaryKey();
const ref = (name: string) => char(name, { length: 26 });
const createdAt = () => datetime("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`);
const updatedAt = () =>
  datetime("updated_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`).$onUpdate(() => new Date());
const money = (name: string) => bigint(name, { mode: "number" }); // minor units
const currency = () => char("currency", { length: 3 }).notNull().default("USD");

/* ---------- users & organizations ---------- */

export const users = mysqlTable("users", {
  id: id(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 120 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  emailVerifiedAt: datetime("email_verified_at", { fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const organizations = mysqlTable("organizations", {
  id: id(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  logoUrl: varchar("logo_url", { length: 500 }),
  website: varchar("website", { length: 300 }),
  accentColor: char("accent_color", { length: 7 }),
  socialLinks: json("social_links").$type<SocialLink[]>().notNull().default([]),
  // Stripe: cloud edition connects via Connect; self-hosted uses env keys
  stripeAccountId: varchar("stripe_account_id", { length: 60 }),
  stripeAccountType: mysqlEnum("stripe_account_type", ["standard", "express"]),
  stripeChargesEnabled: boolean("stripe_charges_enabled").notNull().default(false),
  feePassThrough: boolean("fee_pass_through").notNull().default(false), // default for new events
  deletedAt: datetime("deleted_at", { fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const organizationMembers = mysqlTable(
  "organization_members",
  {
    organizationId: ref("organization_id").notNull(),
    userId: ref("user_id").notNull(),
    role: mysqlEnum("role", ["owner", "admin", "member", "checkin"]).notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.userId] }), index("om_user").on(t.userId)],
);

export const organizationInvites = mysqlTable("organization_invites", {
  id: id(),
  organizationId: ref("organization_id").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "member", "checkin"]).notNull().default("member"),
  token: char("token", { length: 48 }).notNull().unique(),
  expiresAt: datetime("expires_at", { fsp: 3 }).notNull(),
  acceptedAt: datetime("accepted_at", { fsp: 3 }),
  createdAt: createdAt(),
});

/* ---------- events ---------- */

export const events = mysqlTable(
  "events",
  {
    id: id(),
    organizationId: ref("organization_id").notNull(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    descriptionMd: text("description_md"),
    coverImageUrl: varchar("cover_image_url", { length: 500 }),
    logoUrl: varchar("logo_url", { length: 500 }),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    startsAt: datetime("starts_at", { fsp: 3 }).notNull(),
    endsAt: datetime("ends_at", { fsp: 3 }).notNull(),
    // venue
    locationType: mysqlEnum("location_type", ["in_person", "online", "hybrid"]).notNull().default("in_person"),
    venueName: varchar("venue_name", { length: 160 }),
    address: varchar("address", { length: 300 }),
    city: varchar("city", { length: 100 }),
    country: char("country", { length: 2 }),
    lat: varchar("lat", { length: 20 }),
    lng: varchar("lng", { length: 20 }),
    onlineUrl: varchar("online_url", { length: 500 }), // revealed after registration
    // visibility & flow
    visibility: mysqlEnum("visibility", ["public", "unlisted", "private"]).notNull().default("public"),
    status: mysqlEnum("status", ["draft", "published", "cancelled", "ended"]).notNull().default("draft"),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    capacity: int("capacity"),
    waitlistEnabled: boolean("waitlist_enabled").notNull().default(false),
    collectPhone: boolean("collect_phone").notNull().default(false),
    // guests: each guest is an attendee row (own ticket) linked to the host via attendees.guestOfAttendeeId,
    // charged at the host's ticket type price, and asked the "guest"-scoped registration fields
    guestsEnabled: boolean("guests_enabled").notNull().default(false),
    maxGuests: int("max_guests").notNull().default(1),
    feePassThrough: boolean("fee_pass_through").notNull().default(false),
    refundPolicy: text("refund_policy"),
    socialLinks: json("social_links").$type<SocialLink[]>().notNull().default([]),
    reminderHours: json("reminder_hours").$type<number[]>().notNull().default([24, 1]),
    publishedAt: datetime("published_at", { fsp: 3 }),
    deletedAt: datetime("deleted_at", { fsp: 3 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("ev_org").on(t.organizationId),
    index("ev_discover").on(t.visibility, t.status, t.startsAt),
    index("ev_city").on(t.city, t.startsAt),
  ],
);

export const eventHosts = mysqlTable("event_hosts", {
  id: id(),
  eventId: ref("event_id").notNull(),
  userId: ref("user_id"),
  name: varchar("name", { length: 120 }).notNull(),
  title: varchar("title", { length: 120 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  socialLinks: json("social_links").$type<SocialLink[]>().notNull().default([]),
  position: int("position").notNull().default(0),
});

export const eventSponsors = mysqlTable("event_sponsors", {
  id: id(),
  eventId: ref("event_id").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  logoUrl: varchar("logo_url", { length: 500 }),
  tier: varchar("tier", { length: 60 }),
  website: varchar("website", { length: 300 }),
  socialLinks: json("social_links").$type<SocialLink[]>().notNull().default([]),
  position: int("position").notNull().default(0),
});

export const tags = mysqlTable("tags", {
  id: id(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  name: varchar("name", { length: 60 }).notNull(),
  curated: boolean("curated").notNull().default(false),
});

export const eventTags = mysqlTable(
  "event_tags",
  { eventId: ref("event_id").notNull(), tagId: ref("tag_id").notNull() },
  (t) => [primaryKey({ columns: [t.eventId, t.tagId] }), index("et_tag").on(t.tagId)],
);

export const eventInvites = mysqlTable("event_invites", {
  id: id(),
  eventId: ref("event_id").notNull(),
  email: varchar("email", { length: 255 }),
  token: char("token", { length: 48 }).notNull().unique(),
  maxUses: int("max_uses").notNull().default(1),
  uses: int("uses").notNull().default(0),
  expiresAt: datetime("expires_at", { fsp: 3 }),
  createdAt: createdAt(),
});

/* ---------- ticketing ---------- */

export const ticketTypes = mysqlTable(
  "ticket_types",
  {
    id: id(),
    eventId: ref("event_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    priceMinor: money("price_minor").notNull().default(0),
    currency: currency(),
    quantity: int("quantity"), // null = unlimited
    sold: int("sold").notNull().default(0),
    held: int("held").notNull().default(0),
    minPerOrder: int("min_per_order").notNull().default(1),
    maxPerOrder: int("max_per_order").notNull().default(10),
    salesStartAt: datetime("sales_start_at", { fsp: 3 }),
    salesEndAt: datetime("sales_end_at", { fsp: 3 }),
    hidden: boolean("hidden").notNull().default(false),
    accessCode: varchar("access_code", { length: 60 }),
    taxRateBps: int("tax_rate_bps").notNull().default(0),
    position: int("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tt_event").on(t.eventId)],
);

export const discountCodes = mysqlTable(
  "discount_codes",
  {
    id: id(),
    eventId: ref("event_id").notNull(),
    code: varchar("code", { length: 40 }).notNull(),
    kind: mysqlEnum("kind", ["percent", "fixed"]).notNull(),
    value: int("value").notNull(), // percent (0-100) or minor units
    maxUses: int("max_uses"),
    uses: int("uses").notNull().default(0),
    expiresAt: datetime("expires_at", { fsp: 3 }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("dc_event_code").on(t.eventId, t.code)],
);

/* ---------- registration form ---------- */

export const registrationFields = mysqlTable(
  "registration_fields",
  {
    id: id(),
    eventId: ref("event_id").notNull(),
    key: varchar("key", { length: 60 }).notNull(), // stable machine key
    label: varchar("label", { length: 160 }).notNull(),
    helpText: varchar("help_text", { length: 300 }),
    placeholder: varchar("placeholder", { length: 120 }),
    type: mysqlEnum("type", [
      "short_text", "long_text", "email", "phone", "number", "select", "multi_select",
      "checkbox", "date", "url", "file", "consent",
    ]).notNull(),
    options: json("options").$type<FieldOption[]>(),
    required: boolean("required").notNull().default(false),
    scope: mysqlEnum("scope", ["order", "attendee", "guest"]).notNull().default("attendee"),
    ticketTypeIds: json("ticket_type_ids").$type<string[]>(), // null = all
    condition: json("condition").$type<ConditionGroup>(),
    position: int("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("rf_event_key").on(t.eventId, t.key)],
);

/* ---------- orders, attendees, tickets ---------- */

export const orders = mysqlTable(
  "orders",
  {
    id: id(),
    eventId: ref("event_id").notNull(),
    organizationId: ref("organization_id").notNull(),
    userId: ref("user_id"),
    email: varchar("email", { length: 255 }).notNull(),
    status: mysqlEnum("status", ["pending", "paid", "free", "refunded", "partially_refunded", "failed", "expired"])
      .notNull()
      .default("pending"),
    currency: currency(),
    subtotalMinor: money("subtotal_minor").notNull().default(0),
    discountMinor: money("discount_minor").notNull().default(0),
    taxMinor: money("tax_minor").notNull().default(0),
    serviceFeeMinor: money("service_fee_minor").notNull().default(0), // shown to buyer when passed through
    totalMinor: money("total_minor").notNull().default(0),
    platformFeeMinor: money("platform_fee_minor").notNull().default(0), // 0.99% on cloud
    refundedMinor: money("refunded_minor").notNull().default(0),
    discountCodeId: ref("discount_code_id"),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 80 }),
    stripeAccountId: varchar("stripe_account_id", { length: 60 }),
    holdExpiresAt: datetime("hold_expires_at", { fsp: 3 }),
    paidAt: datetime("paid_at", { fsp: 3 }),
    answers: json("answers").$type<Record<string, unknown>>().notNull().default({}), // order-scope fields
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("ord_event").on(t.eventId, t.status),
    index("ord_email").on(t.email),
    index("ord_hold").on(t.status, t.holdExpiresAt), // expireHolds sweep
    uniqueIndex("ord_pi").on(t.stripePaymentIntentId),
  ],
);

export const orderItems = mysqlTable("order_items", {
  id: id(),
  orderId: ref("order_id").notNull(),
  ticketTypeId: ref("ticket_type_id").notNull(),
  quantity: int("quantity").notNull(),
  unitPriceMinor: money("unit_price_minor").notNull(),
});

export const attendees = mysqlTable(
  "attendees",
  {
    id: id(),
    eventId: ref("event_id").notNull(),
    orderId: ref("order_id").notNull(),
    ticketTypeId: ref("ticket_type_id").notNull(),
    userId: ref("user_id"),
    guestOfAttendeeId: ref("guest_of_attendee_id"), // set on +1s; null on the host attendee
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(), // guests without their own email carry the host's
    phone: varchar("phone", { length: 32 }), // E.164
    smsOptIn: boolean("sms_opt_in").notNull().default(false),
    remindersOptOut: boolean("reminders_opt_out").notNull().default(false),
    status: mysqlEnum("status", ["pending_approval", "confirmed", "rejected", "cancelled", "waitlisted"])
      .notNull()
      .default("confirmed"),
    answers: json("answers").$type<Record<string, unknown>>().notNull().default({}),
    deletedAt: datetime("deleted_at", { fsp: 3 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("att_event").on(t.eventId, t.status), index("att_email").on(t.eventId, t.email), index("att_guest_of").on(t.guestOfAttendeeId)],
);

export const tickets = mysqlTable(
  "tickets",
  {
    id: id(),
    attendeeId: ref("attendee_id").notNull().unique(),
    eventId: ref("event_id").notNull(),
    token: char("token", { length: 48 }).notNull().unique(), // signed, used in QR + /t/{token}
    revokedAt: datetime("revoked_at", { fsp: 3 }),
    createdAt: createdAt(),
  },
  (t) => [index("tk_event").on(t.eventId)],
);

export const checkIns = mysqlTable(
  "check_ins",
  {
    id: id(),
    ticketId: ref("ticket_id").notNull(),
    eventId: ref("event_id").notNull(),
    checkedInBy: ref("checked_in_by"),
    method: mysqlEnum("method", ["scan", "manual"]).notNull(),
    undoneAt: datetime("undone_at", { fsp: 3 }),
    createdAt: createdAt(),
  },
  (t) => [index("ci_ticket").on(t.ticketId)],
);

export const waitlistEntries = mysqlTable(
  "waitlist_entries",
  {
    id: id(),
    eventId: ref("event_id").notNull(),
    ticketTypeId: ref("ticket_type_id"),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 120 }),
    promotedAt: datetime("promoted_at", { fsp: 3 }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("wl_event_email").on(t.eventId, t.email)],
);

/* ---------- notifications ---------- */

export const notifications = mysqlTable(
  "notifications",
  {
    id: id(),
    organizationId: ref("organization_id").notNull(),
    eventId: ref("event_id"),
    attendeeId: ref("attendee_id"),
    channel: mysqlEnum("channel", ["email", "sms"]).notNull(),
    template: varchar("template", { length: 60 }).notNull(),
    recipient: varchar("recipient", { length: 255 }).notNull(),
    // queued → sending (claimed by a worker) → sent → delivered | bounced; failed after retries; skipped by the SMS gate
    status: mysqlEnum("status", ["queued", "sending", "sent", "delivered", "bounced", "failed", "skipped"])
      .notNull()
      .default("queued"),
    data: json("data").$type<Record<string, unknown>>(), // template variables (e.g. reminder hours)
    dedupeKey: varchar("dedupe_key", { length: 120 }), // e.g. reminder:{attendeeId}:{hours}:{channel}
    attempts: int("attempts").notNull().default(0),
    providerMessageId: varchar("provider_message_id", { length: 120 }),
    error: varchar("error", { length: 300 }),
    scheduledFor: datetime("scheduled_for", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    sentAt: datetime("sent_at", { fsp: 3 }),
    createdAt: createdAt(),
  },
  (t) => [
    index("nt_queue").on(t.status, t.scheduledFor),
    index("nt_event").on(t.eventId, t.template),
    index("nt_provider").on(t.providerMessageId),
    uniqueIndex("nt_dedupe").on(t.dedupeKey),
  ],
);

// Cloud: a free event pays $5 once to unlock unlimited transactional SMS
export const smsUnlocks = mysqlTable("sms_unlocks", {
  id: id(),
  eventId: ref("event_id").notNull().unique(),
  organizationId: ref("organization_id").notNull(),
  amountMinor: money("amount_minor").notNull().default(500),
  currency: currency(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 80 }),
  paidAt: datetime("paid_at", { fsp: 3 }),
  createdAt: createdAt(),
});

/* ---------- API & webhooks ---------- */

export const apiKeys = mysqlTable(
  "api_keys",
  {
    id: id(),
    organizationId: ref("organization_id").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    prefix: char("prefix", { length: 12 }).notNull(),
    hash: char("hash", { length: 64 }).notNull().unique(), // sha-256
    scopes: json("scopes").$type<string[]>().notNull().default(["read"]),
    lastUsedAt: datetime("last_used_at", { fsp: 3 }),
    revokedAt: datetime("revoked_at", { fsp: 3 }),
    createdAt: createdAt(),
  },
  (t) => [index("ak_org").on(t.organizationId)],
);

export const webhooks = mysqlTable("webhooks", {
  id: id(),
  organizationId: ref("organization_id").notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  secret: char("secret", { length: 64 }).notNull(),
  events: json("events").$type<string[]>().notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const webhookDeliveries = mysqlTable(
  "webhook_deliveries",
  {
    id: id(),
    webhookId: ref("webhook_id").notNull(),
    event: varchar("event", { length: 60 }).notNull(),
    payload: json("payload").notNull(),
    attempts: int("attempts").notNull().default(0),
    nextAttemptAt: datetime("next_attempt_at", { fsp: 3 }),
    responseStatus: int("response_status"),
    deliveredAt: datetime("delivered_at", { fsp: 3 }),
    createdAt: createdAt(),
  },
  (t) => [index("wd_pending").on(t.deliveredAt, t.nextAttemptAt)],
);

/* ---------- auth (Auth.js) ---------- */

export const sessions = mysqlTable("sessions", {
  token: char("token", { length: 64 }).primaryKey(),
  userId: ref("user_id").notNull(),
  expiresAt: datetime("expires_at", { fsp: 3 }).notNull(),
});

export const verificationTokens = mysqlTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: char("token", { length: 64 }).notNull(),
    expiresAt: datetime("expires_at", { fsp: 3 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ---------- relations ---------- */

export const eventsRelations = relations(events, ({ one, many }) => ({
  organization: one(organizations, { fields: [events.organizationId], references: [organizations.id] }),
  hosts: many(eventHosts),
  sponsors: many(eventSponsors),
  ticketTypes: many(ticketTypes),
  fields: many(registrationFields),
  tags: many(eventTags),
}));
export const eventHostsRelations = relations(eventHosts, ({ one }) => ({
  event: one(events, { fields: [eventHosts.eventId], references: [events.id] }),
}));
export const eventSponsorsRelations = relations(eventSponsors, ({ one }) => ({
  event: one(events, { fields: [eventSponsors.eventId], references: [events.id] }),
}));
export const ticketTypesRelations = relations(ticketTypes, ({ one }) => ({
  event: one(events, { fields: [ticketTypes.eventId], references: [events.id] }),
}));
export const registrationFieldsRelations = relations(registrationFields, ({ one }) => ({
  event: one(events, { fields: [registrationFields.eventId], references: [events.id] }),
}));
export const eventTagsRelations = relations(eventTags, ({ one }) => ({
  event: one(events, { fields: [eventTags.eventId], references: [events.id] }),
  tag: one(tags, { fields: [eventTags.tagId], references: [tags.id] }),
}));
export const ordersRelations = relations(orders, ({ many }) => ({ items: many(orderItems), attendees: many(attendees) }));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));
export const attendeesRelations = relations(attendees, ({ one }) => ({
  order: one(orders, { fields: [attendees.orderId], references: [orders.id] }),
  ticket: one(tickets, { fields: [attendees.id], references: [tickets.attendeeId] }),
}));

/* ---------- JSON column types ---------- */

export type SocialPlatform =
  | "website" | "x" | "linkedin" | "instagram" | "youtube" | "discord"
  | "bluesky" | "threads" | "tiktok" | "mastodon" | "other";
export type SocialLink = { platform: SocialPlatform; url: string };
export type FieldOption = { value: string; label: string };
export type ConditionOperator = "eq" | "neq" | "contains" | "empty" | "not_empty";
export type ConditionRule = { fieldKey: string; op: ConditionOperator; value?: string };
export type ConditionGroup = { op: "and" | "or"; rules: ConditionRule[] };

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type TicketType = typeof ticketTypes.$inferSelect;
export type RegistrationField = typeof registrationFields.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Attendee = typeof attendees.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
