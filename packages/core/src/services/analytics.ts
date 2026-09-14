import { createHash, createHmac } from "node:crypto";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { attendees, checkIns, events, eventVisits, notifications, orders, type Database } from "@evnelo/db";
import { newId } from "../ids";

/* ---------- visits: recording ---------- */

/** The UTC calendar day a visit is filed under, "YYYY-MM-DD". */
export const utcDay = (at = new Date()) => at.toISOString().slice(0, 10);

/**
 * A one-way visitor id for one day: sha256 over a daily HMAC salt, the client address and the
 * user agent. The address is never stored and the salt cannot be recovered without the secret,
 * so two visits on the same day by the same browser count once and nothing identifies a person.
 */
export function visitorHash(secret: string, day: string, address: string | null | undefined, userAgent: string | null | undefined) {
  const salt = createHmac("sha256", secret).update(day).digest();
  return createHash("sha256").update(salt).update(address ?? "").update("\n").update(userAgent ?? "").digest("hex");
}

/** The referrer's host, or null for direct traffic and for pages of the app itself. */
export function referrerHost(referrer: string | null | undefined, ownHost: string) {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    return host && host !== ownHost.replace(/^www\./, "").toLowerCase() ? host.slice(0, 255) : null;
  } catch {
    return null;
  }
}

export function deviceFromUserAgent(userAgent: string | null | undefined): "desktop" | "mobile" {
  return userAgent && /Mobi|Android|iPhone|iPad/i.test(userAgent) ? "mobile" : "desktop";
}

/** The utm_* parameters of a landing URL, trimmed to what the table stores. */
export function utmFromSearch(search: string | null | undefined) {
  const params = new URLSearchParams(search ?? "");
  const pick = (key: string) => params.get(key)?.trim().slice(0, 100) || null;
  return { utmSource: pick("utm_source"), utmMedium: pick("utm_medium"), utmCampaign: pick("utm_campaign") };
}

export type VisitInput = {
  eventId: string;
  day: string;
  visitorHash: string;
  referrerHost?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  country?: string | null;
  device?: "desktop" | "mobile" | null;
};

/** A page view: a new row for the first visit of the day, one more view on the same row afterwards. */
export async function recordVisit(db: Database, visit: VisitInput) {
  await db.insert(eventVisits)
    .values({ id: newId(), ...visit })
    .onDuplicateKeyUpdate({ set: { views: sql`${eventVisits.views} + 1`, lastAt: sql`CURRENT_TIMESTAMP(3)` } });
}

/**
 * The visitor opened the registration dialog or registered. Registering implies opening. A
 * milestone without a prior view (an API registration, a blocked beacon) still gets a row so the
 * funnel never shows more registrations than visitors.
 */
export async function markVisitMilestone(db: Database, key: { eventId: string; day: string; visitorHash: string }, milestone: "opened" | "registered") {
  const flags = milestone === "registered" ? { openedRegistration: true, registered: true } : { openedRegistration: true };
  await db.insert(eventVisits)
    .values({ id: newId(), ...key, views: 0, ...flags })
    .onDuplicateKeyUpdate({ set: { ...flags, lastAt: sql`CURRENT_TIMESTAMP(3)` } });
}

/** Rows older than the retention window; the aggregates hosts look at never go that far back. */
export async function purgeEventVisits(db: Database, now = new Date(), keepDays = 400) {
  const cutoff = utcDay(new Date(now.getTime() - keepDays * 86_400_000));
  const [result] = await db.delete(eventVisits).where(lt(eventVisits.day, cutoff));
  return result.affectedRows;
}

/* ---------- reporting ---------- */

/** Inclusive calendar-day range; `from` null means all time. */
export type DayRange = { from: string | null; to: string };

export function dayRange(days: number | null, now = new Date()): DayRange {
  const to = utcDay(now);
  if (!days) return { from: null, to };
  return { from: utcDay(new Date(now.getTime() - (days - 1) * 86_400_000)), to };
}

const n = (v: unknown) => Number(v ?? 0);

async function emailHealth(db: Database, scope: ReturnType<typeof eq> | ReturnType<typeof and>, range: DayRange) {
  const [row] = await db.select({
    sent: sql<number>`sum(case when ${notifications.status} in ('sent','delivered','bounced') then 1 else 0 end)`,
    delivered: sql<number>`sum(case when ${notifications.status} = 'delivered' then 1 else 0 end)`,
    bounced: sql<number>`sum(case when ${notifications.status} = 'bounced' then 1 else 0 end)`,
    failed: sql<number>`sum(case when ${notifications.status} = 'failed' then 1 else 0 end)`,
    opened: sql<number>`sum(case when ${notifications.openedAt} is not null then 1 else 0 end)`,
    clicked: sql<number>`sum(case when ${notifications.clickedAt} is not null then 1 else 0 end)`,
  }).from(notifications).where(and(scope, eq(notifications.channel, "email"), range.from ? gte(notifications.createdAt, new Date(`${range.from}T00:00:00Z`)) : undefined, lte(notifications.createdAt, new Date(`${range.to}T23:59:59.999Z`))));
  return { sent: n(row?.sent), delivered: n(row?.delivered), bounced: n(row?.bounced), failed: n(row?.failed), opened: n(row?.opened), clicked: n(row?.clicked) };
}

export type EventAnalytics = Awaited<ReturnType<typeof eventAnalytics>>;

/** Everything the event's Analytics tab shows: traffic, funnel, sources, audience and email health. */
export async function eventAnalytics(db: Database, eventId: string, range: DayRange) {
  const inRange = and(eq(eventVisits.eventId, eventId), range.from ? gte(eventVisits.day, range.from) : undefined, lte(eventVisits.day, range.to));
  const visitorsWithViews = and(inRange, sql`${eventVisits.views} > 0`);
  const [totals] = await db.select({
    visitors: sql<number>`sum(case when ${eventVisits.views} > 0 then 1 else 0 end)`,
    views: sql<number>`coalesce(sum(${eventVisits.views}), 0)`,
    opened: sql<number>`sum(case when ${eventVisits.openedRegistration} then 1 else 0 end)`,
    registered: sql<number>`sum(case when ${eventVisits.registered} then 1 else 0 end)`,
    bounces: sql<number>`sum(case when ${eventVisits.views} = 1 and not ${eventVisits.openedRegistration} then 1 else 0 end)`,
  }).from(eventVisits).where(inRange);
  const byDay = await db.select({
    day: eventVisits.day,
    visitors: sql<number>`sum(case when ${eventVisits.views} > 0 then 1 else 0 end)`,
    views: sql<number>`sum(${eventVisits.views})`,
    registered: sql<number>`sum(case when ${eventVisits.registered} then 1 else 0 end)`,
  }).from(eventVisits).where(inRange).groupBy(eventVisits.day).orderBy(eventVisits.day);
  const sources = await db.select({ host: eventVisits.referrerHost, visitors: sql<number>`count(*)`, registered: sql<number>`sum(case when ${eventVisits.registered} then 1 else 0 end)` })
    .from(eventVisits).where(visitorsWithViews).groupBy(eventVisits.referrerHost).orderBy(desc(sql`count(*)`)).limit(10);
  const campaigns = await db.select({ source: eventVisits.utmSource, medium: eventVisits.utmMedium, campaign: eventVisits.utmCampaign, visitors: sql<number>`count(*)`, registered: sql<number>`sum(case when ${eventVisits.registered} then 1 else 0 end)` })
    .from(eventVisits).where(and(visitorsWithViews, isNotNull(eventVisits.utmSource))).groupBy(eventVisits.utmSource, eventVisits.utmMedium, eventVisits.utmCampaign).orderBy(desc(sql`count(*)`)).limit(10);
  const countries = await db.select({ country: eventVisits.country, visitors: sql<number>`count(*)` })
    .from(eventVisits).where(and(visitorsWithViews, isNotNull(eventVisits.country))).groupBy(eventVisits.country).orderBy(desc(sql`count(*)`)).limit(10);
  const devices = await db.select({ device: eventVisits.device, visitors: sql<number>`count(*)` })
    .from(eventVisits).where(and(visitorsWithViews, isNotNull(eventVisits.device))).groupBy(eventVisits.device);
  const email = await emailHealth(db, eq(notifications.eventId, eventId), range);
  return {
    visitors: n(totals?.visitors), views: n(totals?.views), opened: n(totals?.opened), registered: n(totals?.registered), bounces: n(totals?.bounces),
    byDay: byDay.map((d) => ({ day: String(d.day), visitors: n(d.visitors), views: n(d.views), registered: n(d.registered) })),
    sources: sources.map((s) => ({ host: s.host, visitors: n(s.visitors), registered: n(s.registered) })),
    campaigns: campaigns.map((c) => ({ source: c.source ?? "", medium: c.medium, campaign: c.campaign, visitors: n(c.visitors), registered: n(c.registered) })),
    countries: countries.map((c) => ({ country: c.country ?? "", visitors: n(c.visitors) })),
    devices: devices.map((d) => ({ device: d.device ?? "desktop", visitors: n(d.visitors) })),
    email,
  };
}

export type OrganizationAnalytics = Awaited<ReturnType<typeof organizationAnalytics>>;

/** The account-wide report: registrations, revenue, traffic, check-ins and email health across every event. */
export async function organizationAnalytics(db: Database, organizationId: string, range: DayRange) {
  const fromAt = range.from ? new Date(`${range.from}T00:00:00Z`) : null;
  const toAt = new Date(`${range.to}T23:59:59.999Z`);
  const eventIds = (await db.select({ id: events.id }).from(events).where(and(eq(events.organizationId, organizationId), isNull(events.deletedAt)))).map((e) => e.id);
  if (!eventIds.length) return null;
  const inEvents = <T extends { eventId: unknown }>(col: T["eventId"]) => inArray(col as never, eventIds);

  const registrationsByDay = await db.select({ day: sql<string>`date(${attendees.createdAt})`, count: sql<number>`count(*)` })
    .from(attendees)
    .where(and(inEvents<typeof attendees>(attendees.eventId), inArray(attendees.status, ["confirmed", "pending_approval"]), isNull(attendees.deletedAt), fromAt ? gte(attendees.createdAt, fromAt) : undefined, lte(attendees.createdAt, toAt)))
    .groupBy(sql`date(${attendees.createdAt})`).orderBy(sql`date(${attendees.createdAt})`);
  const revenueByMonth = await db.select({ month: sql<string>`date_format(${orders.paidAt}, '%Y-%m')`, currency: orders.currency, amount: sql<number>`sum(${orders.totalMinor} - ${orders.refundedMinor})`, orders: sql<number>`count(*)` })
    .from(orders)
    .where(and(inEvents<typeof orders>(orders.eventId), inArray(orders.status, ["paid", "partially_refunded"]), isNotNull(orders.paidAt), fromAt ? gte(orders.paidAt, fromAt) : undefined, lte(orders.paidAt, toAt)))
    .groupBy(sql`date_format(${orders.paidAt}, '%Y-%m')`, orders.currency).orderBy(sql`date_format(${orders.paidAt}, '%Y-%m')`);
  const [traffic] = await db.select({
    visitors: sql<number>`sum(case when ${eventVisits.views} > 0 then 1 else 0 end)`,
    views: sql<number>`coalesce(sum(${eventVisits.views}), 0)`,
    registered: sql<number>`sum(case when ${eventVisits.registered} then 1 else 0 end)`,
  }).from(eventVisits).where(and(inEvents<typeof eventVisits>(eventVisits.eventId), range.from ? gte(eventVisits.day, range.from) : undefined, lte(eventVisits.day, range.to)));
  const [doors] = await db.select({
    checkedIn: sql<number>`(select count(*) from ${checkIns} c where c.event_id in (${sql.join(eventIds.map((id) => sql`${id}`), sql`, `)}) and c.undone_at is null and c.created_at <= ${toAt}${fromAt ? sql` and c.created_at >= ${fromAt}` : sql``})`,
    confirmed: sql<number>`(select count(*) from ${attendees} a inner join ${events} e on e.id = a.event_id where e.organization_id = ${organizationId} and e.deleted_at is null and e.status != 'draft' and a.status = 'confirmed' and a.deleted_at is null and e.starts_at <= ${toAt}${fromAt ? sql` and e.starts_at >= ${fromAt}` : sql``})`,
  }).from(sql`dual`);
  const topEvents = await db.select({
    id: events.id, name: events.name, slug: events.slug, startsAt: events.startsAt, status: events.status,
    registrations: sql<number>`(select count(*) from ${attendees} a where a.event_id = events.id and a.status in ('confirmed','pending_approval') and a.deleted_at is null${fromAt ? sql` and a.created_at >= ${fromAt}` : sql``} and a.created_at <= ${toAt})`.as("registrations"),
    revenue: sql<number>`(select coalesce(sum(o.total_minor - o.refunded_minor), 0) from ${orders} o where o.event_id = events.id and o.status in ('paid','partially_refunded') and o.paid_at is not null${fromAt ? sql` and o.paid_at >= ${fromAt}` : sql``} and o.paid_at <= ${toAt})`,
    currency: sql<string>`(select o.currency from ${orders} o where o.event_id = events.id limit 1)`,
    visitors: sql<number>`(select count(*) from ${eventVisits} v where v.event_id = events.id and v.views > 0${range.from ? sql` and v.day >= ${range.from}` : sql``} and v.day <= ${range.to})`,
    checkedIn: sql<number>`(select count(*) from ${checkIns} c where c.event_id = events.id and c.undone_at is null)`,
  }).from(events).where(and(eq(events.organizationId, organizationId), isNull(events.deletedAt))).orderBy(desc(sql.identifier("registrations")), desc(events.startsAt)).limit(10);
  const email = await emailHealth(db, eq(notifications.organizationId, organizationId), range);
  return {
    events: eventIds.length,
    registrations: registrationsByDay.reduce((a, d) => a + n(d.count), 0),
    registrationsByDay: registrationsByDay.map((d) => ({ day: String(d.day), count: n(d.count) })),
    revenueByMonth: revenueByMonth.map((m) => ({ month: String(m.month), currency: m.currency, amountMinor: n(m.amount), orders: n(m.orders) })),
    traffic: { visitors: n(traffic?.visitors), views: n(traffic?.views), registered: n(traffic?.registered) },
    doors: { checkedIn: n(doors?.checkedIn), confirmed: n(doors?.confirmed) },
    topEvents: topEvents.map((e) => ({ ...e, registrations: n(e.registrations), revenue: n(e.revenue), currency: e.currency ?? "USD", visitors: n(e.visitors), checkedIn: n(e.checkedIn) })),
    email,
  };
}

const csvCell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** The top-events table as a spreadsheet: one line per event, amounts in major units. */
export function organizationAnalyticsCsv(report: NonNullable<OrganizationAnalytics>) {
  const header = ["event", "starts_at", "status", "registrations", "visitors", "revenue", "currency", "checked_in"];
  const lines = report.topEvents.map((e) => [e.name, e.startsAt.toISOString(), e.status, e.registrations, e.visitors, (e.revenue / 100).toFixed(2), e.currency, e.checkedIn].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n") + "\n";
}
