import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { ticketTypes, type Database } from "@ot/db";
import { newId } from "../ids";

export const ticketTypeInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).transform((v) => v || null).nullable().optional(),
  priceMinor: z.coerce.number().int().min(0),
  currency: z.string().trim().toUpperCase().length(3).default("USD"),
  quantity: z.coerce.number().int().min(1).nullable().optional(), // null = unlimited
  minPerOrder: z.coerce.number().int().min(1).max(50).default(1),
  maxPerOrder: z.coerce.number().int().min(1).max(50).default(10),
  salesStartAt: z.coerce.date().nullable().optional(),
  salesEndAt: z.coerce.date().nullable().optional(),
  hidden: z.boolean().default(false),
  accessCode: z.string().trim().max(60).transform((v) => v || null).nullable().optional(),
  taxRateBps: z.coerce.number().int().min(0).max(10_000).default(0),
}).refine((t) => t.maxPerOrder >= t.minPerOrder, { message: "Max per order must be at least the minimum.", path: ["maxPerOrder"] });
export type TicketTypeInput = z.infer<typeof ticketTypeInput>;

export async function listTicketTypes(db: Database, eventId: string) {
  return db.select().from(ticketTypes).where(eq(ticketTypes.eventId, eventId)).orderBy(asc(ticketTypes.position), asc(ticketTypes.createdAt));
}

export async function upsertTicketType(db: Database, eventId: string, input: TicketTypeInput, id?: string) {
  const values = {
    name: input.name, description: input.description ?? null, priceMinor: input.priceMinor, currency: input.currency,
    quantity: input.quantity ?? null, minPerOrder: input.minPerOrder, maxPerOrder: input.maxPerOrder,
    salesStartAt: input.salesStartAt ?? null, salesEndAt: input.salesEndAt ?? null, hidden: input.hidden,
    accessCode: input.accessCode ?? null, taxRateBps: input.taxRateBps,
  };
  if (id) {
    const [existing] = await db.select({ id: ticketTypes.id, sold: ticketTypes.sold, held: ticketTypes.held }).from(ticketTypes).where(and(eq(ticketTypes.id, id), eq(ticketTypes.eventId, eventId))).limit(1);
    if (!existing) throw new Error("Ticket type not found.");
    if (values.quantity != null && values.quantity < existing.sold + existing.held) throw new Error(`Quantity can't be below the ${existing.sold + existing.held} already sold or held.`);
    await db.update(ticketTypes).set(values).where(eq(ticketTypes.id, id));
    return id;
  }
  const newTypeId = newId();
  const existing = await listTicketTypes(db, eventId);
  await db.insert(ticketTypes).values({ id: newTypeId, eventId, position: existing.length, ...values });
  return newTypeId;
}

export async function deleteTicketType(db: Database, eventId: string, id: string) {
  const [t] = await db.select({ sold: ticketTypes.sold, held: ticketTypes.held }).from(ticketTypes).where(and(eq(ticketTypes.id, id), eq(ticketTypes.eventId, eventId))).limit(1);
  if (!t) throw new Error("Ticket type not found.");
  if (t.sold > 0 || t.held > 0) throw new Error("This ticket type has sales. Hide it instead of deleting it.");
  await db.delete(ticketTypes).where(eq(ticketTypes.id, id));
}

export async function reorderTicketTypes(db: Database, eventId: string, orderedIds: string[]) {
  await db.transaction(async (tx) => {
    for (const [i, id] of orderedIds.entries()) {
      await tx.update(ticketTypes).set({ position: i }).where(and(eq(ticketTypes.id, id), eq(ticketTypes.eventId, eventId)));
    }
  });
}
