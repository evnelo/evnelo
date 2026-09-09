import { and, asc, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { attendees, orders, orderItems, registrationFields, ticketTypes, tickets, type Attendee, type Database } from "@ot/db";
import { issueTickets, queueEmailPerAddress } from "./fulfilment";

export type AttendeeFilter = { q?: string; status?: Attendee["status"] | "all"; limit?: number };

export async function listAttendees(db: Database, eventId: string, filter: AttendeeFilter = {}) {
  const where = [eq(attendees.eventId, eventId), isNull(attendees.deletedAt)];
  if (filter.status && filter.status !== "all") where.push(eq(attendees.status, filter.status));
  if (filter.q) {
    const q = `%${filter.q.trim()}%`;
    where.push(or(like(attendees.name, q), like(attendees.email, q), like(attendees.phone, q))!);
  }
  const host = db.$with("host").as(db.select({ id: attendees.id, name: attendees.name }).from(attendees));
  return db
    .with(host)
    .select({
      attendee: attendees, ticketToken: tickets.token, ticketRevokedAt: tickets.revokedAt, ticketTypeName: ticketTypes.name,
      orderStatus: orders.status, orderTotalMinor: orders.totalMinor, orderCurrency: orders.currency, hostName: host.name,
    })
    .from(attendees)
    .leftJoin(tickets, eq(tickets.attendeeId, attendees.id))
    .innerJoin(ticketTypes, eq(attendees.ticketTypeId, ticketTypes.id))
    .innerJoin(orders, eq(attendees.orderId, orders.id))
    .leftJoin(host, eq(host.id, attendees.guestOfAttendeeId))
    .where(and(...where))
    .orderBy(desc(attendees.createdAt))
    .limit(filter.limit ?? 500);
}

export async function countAttendeesByStatus(db: Database, eventId: string) {
  const rows = await db.select({ status: attendees.status, count: sql<number>`count(*)` }).from(attendees)
    .where(and(eq(attendees.eventId, eventId), isNull(attendees.deletedAt))).groupBy(attendees.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)])) as Partial<Record<Attendee["status"], number>>;
}

/**
 * Approve pending registrations. Tickets are issued right away for free and paid orders;
 * for a paid order still awaiting payment the tickets follow the payment.
 */
export async function approveAttendees(db: Database, eventId: string, ids: string[]) {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(attendees).where(and(eq(attendees.eventId, eventId), inArray(attendees.id, ids), eq(attendees.status, "pending_approval"))).for("update");
    if (!rows.length) return 0;
    await tx.update(attendees).set({ status: "confirmed" }).where(inArray(attendees.id, rows.map((a) => a.id)));
    const byOrder = new Map<string, Attendee[]>();
    for (const a of rows) byOrder.set(a.orderId, [...(byOrder.get(a.orderId) ?? []), { ...a, status: "confirmed" }]);
    for (const [orderId, party] of byOrder) {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) continue;
      if (order.status === "free" || order.status === "paid") await issueTickets(tx, order.organizationId, party);
    }
    return rows.length;
  });
}

/** Reject pending registrations: seat returned, one email per address. Paid orders are refunded separately. */
export async function rejectAttendees(db: Database, eventId: string, ids: string[]) {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(attendees).where(and(eq(attendees.eventId, eventId), inArray(attendees.id, ids), eq(attendees.status, "pending_approval"))).for("update");
    if (!rows.length) return 0;
    await tx.update(attendees).set({ status: "rejected" }).where(inArray(attendees.id, rows.map((a) => a.id)));
    for (const a of rows) {
      const [order] = await tx.select().from(orders).where(eq(orders.id, a.orderId)).limit(1);
      if (!order) continue;
      if (order.status === "free" || order.status === "paid") {
        await tx.update(ticketTypes).set({ sold: sql`GREATEST(${ticketTypes.sold} - 1, 0)` }).where(eq(ticketTypes.id, a.ticketTypeId));
      } else if (order.status === "pending") {
        await tx.update(ticketTypes).set({ held: sql`GREATEST(${ticketTypes.held} - 1, 0)` }).where(eq(ticketTypes.id, a.ticketTypeId));
      }
      await queueEmailPerAddress(tx, order.organizationId, "registration_rejected", [a]);
    }
    return rows.length;
  });
}

/** Cancel confirmed attendees (organizer action): ticket revoked, seat returned. No email; use refund or update flows for that. */
export async function cancelAttendees(db: Database, eventId: string, ids: string[]) {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(attendees).where(and(eq(attendees.eventId, eventId), inArray(attendees.id, ids), inArray(attendees.status, ["confirmed", "pending_approval"]))).for("update");
    if (!rows.length) return 0;
    await tx.update(attendees).set({ status: "cancelled" }).where(inArray(attendees.id, rows.map((a) => a.id)));
    await tx.update(tickets).set({ revokedAt: new Date() }).where(and(inArray(tickets.attendeeId, rows.map((a) => a.id)), isNull(tickets.revokedAt)));
    for (const a of rows) {
      const [order] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, a.orderId)).limit(1);
      const col = order?.status === "pending" ? ticketTypes.held : ticketTypes.sold;
      await tx.update(ticketTypes).set(order?.status === "pending" ? { held: sql`GREATEST(${col} - 1, 0)` } : { sold: sql`GREATEST(${col} - 1, 0)` }).where(eq(ticketTypes.id, a.ticketTypeId));
    }
    return rows.length;
  });
}

/* ---------- CSV export ---------- */

const csvCell = (v: unknown) => {
  const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function attendeesCsv(db: Database, eventId: string, appUrl: string) {
  const [rows, fields] = await Promise.all([
    listAttendees(db, eventId, { status: "all", limit: 50_000 }),
    db.select().from(registrationFields).where(eq(registrationFields.eventId, eventId)).orderBy(asc(registrationFields.position)),
  ]);
  const orderAnswers = new Map<string, Record<string, unknown>>();
  for (const o of await db.select({ id: orders.id, answers: orders.answers }).from(orders).where(eq(orders.eventId, eventId))) orderAnswers.set(o.id, o.answers);
  const fieldCols = fields.map((f) => ({ key: f.key, label: `${f.label} (${f.scope})`, scope: f.scope }));
  const header = ["name", "email", "phone", "sms_opt_in", "status", "ticket_type", "guest_of", "order_status", "registered_at", "ticket_url", ...fieldCols.map((c) => c.label)];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows.sort((a, b) => a.attendee.createdAt.getTime() - b.attendee.createdAt.getTime())) {
    const a = r.attendee;
    const answers = a.guestOfAttendeeId ? a.answers : { ...a.answers, ...(orderAnswers.get(a.orderId) ?? {}) };
    lines.push([
      a.name, a.email, a.phone ?? "", a.smsOptIn ? "yes" : "no", a.status, r.ticketTypeName, r.hostName ?? "", r.orderStatus,
      a.createdAt.toISOString(), r.ticketToken && !r.ticketRevokedAt ? `${appUrl}/t/${r.ticketToken}` : "",
      ...fieldCols.map((c) => answers[c.key]),
    ].map(csvCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/* ---------- orders ---------- */

export async function listOrders(db: Database, eventId: string, limit = 500) {
  const rows = await db
    .select({
      order: orders,
      // raw `orders.id` on purpose: see the note in events.ts about correlated subqueries
      attendeeCount: sql<number>`(select count(*) from ${attendees} a where a.order_id = orders.id)`,
      buyerName: sql<string | null>`(select a.name from ${attendees} a where a.order_id = orders.id and a.guest_of_attendee_id is null limit 1)`,
      items: sql<string>`(select group_concat(concat(oi.quantity, ' x ', t.name) separator ', ') from ${orderItems} oi join ${ticketTypes} t on t.id = oi.ticket_type_id where oi.order_id = orders.id)`,
    })
    .from(orders)
    .where(eq(orders.eventId, eventId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, attendeeCount: Number(r.attendeeCount) }));
}

export async function getOrder(db: Database, eventId: string, orderId: string) {
  const [o] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.eventId, eventId))).limit(1);
  return o ?? null;
}
