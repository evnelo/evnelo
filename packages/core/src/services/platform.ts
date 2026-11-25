import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { attendees, events, organizationMembers, organizations, orders, users, type Database } from "@evnelo/db";

/**
 * The operator's view across every tenant, for the platform admin pages. Read-only and
 * deliberately separate from the per-organization services: nothing here is scoped to a
 * membership, so only call it behind the platform admin check in the web app.
 *
 * Money follows organizationAnalytics: an order counts once it was paid (paid, partially
 * refunded or refunded); `net` is charged minus refunded, `platformFee` is what Evnelo kept
 * (refunds do not return it), all in minor units per currency.
 */

export type Money = { gross: number; refunded: number; net: number; platformFee: number; paidOrders: number };
export type MoneyByCurrency = Record<string, Money>;

const n = (v: unknown) => Number(v ?? 0);
const PAID = ["paid", "partially_refunded", "refunded"] as const;
const LIVE_ATTENDEE = sql`a.status in ('confirmed','pending_approval') and a.deleted_at is null`;

const moneyColumns = {
  currency: orders.currency,
  gross: sql<number>`coalesce(sum(${orders.totalMinor}), 0)`,
  refunded: sql<number>`coalesce(sum(${orders.refundedMinor}), 0)`,
  platformFee: sql<number>`coalesce(sum(${orders.platformFeeMinor}), 0)`,
  paidOrders: sql<number>`count(*)`,
};
const paidOrder = and(inArray(orders.status, [...PAID]), isNotNull(orders.paidAt));

function toMoney(r: { gross: unknown; refunded: unknown; platformFee: unknown; paidOrders: unknown }): Money {
  const gross = n(r.gross), refunded = n(r.refunded);
  return { gross, refunded, net: gross - refunded, platformFee: n(r.platformFee), paidOrders: n(r.paidOrders) };
}

/** Folds grouped rows into `{ key: { currency: Money } }`. */
function byKey<K extends string>(rows: ({ key: K; currency: string } & Parameters<typeof toMoney>[0])[]) {
  const out = new Map<K, MoneyByCurrency>();
  for (const r of rows) {
    const bucket = out.get(r.key) ?? {};
    bucket[r.currency] = toMoney(r);
    out.set(r.key, bucket);
  }
  return out;
}

/** Totals for the whole platform plus one row per organization, newest first, deleted ones included. */
export async function platformOverview(db: Database) {
  const [counts] = await db.select({
    organizations: sql<number>`(select count(*) from ${organizations} o where o.deleted_at is null)`,
    users: sql<number>`(select count(*) from ${users})`,
    events: sql<number>`(select count(*) from ${events} e where e.deleted_at is null)`,
    published: sql<number>`(select count(*) from ${events} e where e.deleted_at is null and e.status in ('published','ended'))`,
    registrations: sql<number>`(select count(*) from ${attendees} a inner join ${events} e on e.id = a.event_id where e.deleted_at is null and ${LIVE_ATTENDEE})`,
  }).from(sql`dual`);

  const totals = await db.select(moneyColumns).from(orders).where(paidOrder).groupBy(orders.currency);

  const rows = await db.select({
    id: organizations.id, name: organizations.name, slug: organizations.slug, createdAt: organizations.createdAt, deletedAt: organizations.deletedAt,
    stripeChargesEnabled: organizations.stripeChargesEnabled, stripeConnected: sql<number>`${organizations.stripeAccountId} is not null`,
    members: sql<number>`(select count(*) from ${organizationMembers} m where m.organization_id = organizations.id)`,
    ownerEmail: sql<string | null>`(select u.email from ${organizationMembers} m inner join ${users} u on u.id = m.user_id where m.organization_id = organizations.id and m.role = 'owner' order by m.created_at limit 1)`,
    events: sql<number>`(select count(*) from ${events} e where e.organization_id = organizations.id and e.deleted_at is null)`,
    published: sql<number>`(select count(*) from ${events} e where e.organization_id = organizations.id and e.deleted_at is null and e.status in ('published','ended'))`,
    registrations: sql<number>`(select count(*) from ${attendees} a inner join ${events} e on e.id = a.event_id where e.organization_id = organizations.id and e.deleted_at is null and ${LIVE_ATTENDEE})`,
    nextEventAt: sql<string | null>`(select min(e.starts_at) from ${events} e where e.organization_id = organizations.id and e.deleted_at is null and e.status = 'published' and e.ends_at >= now())`,
  }).from(organizations).orderBy(desc(organizations.createdAt)).limit(1000);

  const money = byKey(await db.select({ key: orders.organizationId, ...moneyColumns }).from(orders).where(paidOrder).groupBy(orders.organizationId, orders.currency));

  return {
    counts: { organizations: n(counts?.organizations), users: n(counts?.users), events: n(counts?.events), published: n(counts?.published), registrations: n(counts?.registrations) },
    money: Object.fromEntries(totals.map((t) => [t.currency, toMoney(t)])) as MoneyByCurrency,
    organizations: rows.map((r) => ({
      ...r,
      stripeConnected: Boolean(n(r.stripeConnected)),
      members: n(r.members), events: n(r.events), published: n(r.published), registrations: n(r.registrations),
      // raw sql DATETIME subqueries come back as strings
      nextEventAt: r.nextEventAt ? new Date(`${String(r.nextEventAt).replace(" ", "T")}Z`) : null,
      money: money.get(r.id) ?? {},
    })),
  };
}

export type PlatformOverview = Awaited<ReturnType<typeof platformOverview>>;

/** One organization as the operator sees it: members and every event with its sales. Null when the id is unknown. */
export async function platformOrganization(db: Database, organizationId: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) return null;

  const members = await db.select({ name: users.name, email: users.email, role: organizationMembers.role, joinedAt: organizationMembers.createdAt })
    .from(organizationMembers).innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, organizationId)).orderBy(organizationMembers.createdAt);

  const rows = await db.select({
    id: events.id, name: events.name, slug: events.slug, status: events.status, visibility: events.visibility,
    startsAt: events.startsAt, timezone: events.timezone, capacity: events.capacity, createdAt: events.createdAt,
    registrations: sql<number>`(select count(*) from ${attendees} a where a.event_id = events.id and ${LIVE_ATTENDEE})`,
    checkedIn: sql<number>`(select count(*) from check_ins c where c.event_id = events.id and c.undone_at is null)`,
    visitors: sql<number>`(select count(*) from event_visits v where v.event_id = events.id and v.views > 0)`,
  }).from(events).where(and(eq(events.organizationId, organizationId), isNull(events.deletedAt))).orderBy(desc(events.startsAt));

  const money = byKey(await db.select({ key: orders.eventId, ...moneyColumns }).from(orders)
    .where(and(eq(orders.organizationId, organizationId), paidOrder)).groupBy(orders.eventId, orders.currency));
  const totals: MoneyByCurrency = {};
  for (const perEvent of money.values()) for (const [currency, m] of Object.entries(perEvent)) {
    const t = totals[currency] ?? { gross: 0, refunded: 0, net: 0, platformFee: 0, paidOrders: 0 };
    totals[currency] = { gross: t.gross + m.gross, refunded: t.refunded + m.refunded, net: t.net + m.net, platformFee: t.platformFee + m.platformFee, paidOrders: t.paidOrders + m.paidOrders };
  }

  return {
    organization: { id: org.id, name: org.name, slug: org.slug, website: org.website, createdAt: org.createdAt, deletedAt: org.deletedAt, stripeAccountId: org.stripeAccountId, stripeChargesEnabled: org.stripeChargesEnabled },
    members,
    money: totals,
    events: rows.map((r) => ({ ...r, registrations: n(r.registrations), checkedIn: n(r.checkedIn), visitors: n(r.visitors), money: money.get(r.id) ?? {} })),
  };
}

export type PlatformOrganization = NonNullable<Awaited<ReturnType<typeof platformOrganization>>>;
