import { captureError } from "@/lib/observability";
import { NextResponse } from "next/server";
import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { attendees, events, orders, orderItems, organizations, registrationFields, ticketTypes } from "@ot/db";
import { buildAnswersSchema, computeOrder, currentEdition, newId } from "@ot/core";
import { capacityAllows, consumeEventInvite, consumeWaitlistOffer } from "@ot/core/services";
import { eventAccess } from "@/lib/event-access";
import { waitlistOffer } from "@/lib/waitlist-access";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createOrderPaymentIntent } from "@/lib/stripe";
import { fulfilFreeOrder, releaseOrder } from "@/lib/orders";
import { checkoutStripeAccount, paymentsConfigured } from "@/lib/payment-flow";
import { signPaymentResume } from "@/lib/payment-resume";
import { clientAddress } from "@/lib/api-http";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { verifyRegistrationFile } from "@/lib/storage";

export const runtime = "nodejs";
const HOLD_MINUTES = 10;

const email = z.string().trim().email().toLowerCase();
const body = z.object({
  eventId: z.string().length(26),
  ticketTypeId: z.string().length(26),
  name: z.string().trim().min(1),
  email,
  phone: z.string().trim().optional().or(z.literal("")),
  smsOptIn: z.boolean().optional(),
  attendee: z.record(z.unknown()).default({}),
  order: z.record(z.unknown()).default({}),
  // +1s: each becomes an attendee with its own ticket, priced at the host's ticket type
  guests: z.array(z.object({
    name: z.string().trim().min(1),
    email: email.optional().or(z.literal("")),
    answers: z.record(z.unknown()).default({}),
  })).max(20).default([]),
});

/**
 * Creates an order for one ticket type: the registrant plus optional guests.
 * Free → attendees confirmed immediately (or pending approval) and order status "free".
 * Paid → inventory held for 10 min, PaymentIntent returned for the Payment Element.
 * Inventory is guarded with a conditional UPDATE so flash sales can't oversell.
 * One live registration per email per event (guests with their own email included).
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the form and try again.", issues: parsed.error.issues }, { status: 400 });
  const input = parsed.data;

  // Abuse limits: per client when a trusted proxy header identifies one, per email, and a per-event
  // ceiling that keeps a scripted flood from exhausting holds or the notification queue.
  const address = clientAddress(req);
  const allowed = await Promise.all([
    address ? consumeSharedRateLimit("register:client", address, 10, 10 * 60_000) : true,
    consumeSharedRateLimit("register:email", input.email, 5, 10 * 60_000),
    consumeSharedRateLimit("register:event", input.eventId, 600, 60_000),
  ]);
  if (allowed.includes(false)) return NextResponse.json({ error: "Too many registration attempts. Wait a few minutes and try again." }, { status: 429, headers: { "Retry-After": "60" } });

  const [event] = await db.select().from(events).where(eq(events.id, input.eventId)).limit(1);
  if (!event || event.status !== "published") return NextResponse.json({ error: "This event isn't open for registration." }, { status: 404 });
  // private events: an organization member, or a valid invite cookie (set by /i/{token}); email-bound invites must match
  const access = event.visibility === "private" ? await eventAccess(event) : { isMember: false, invite: null, inviteProblem: null };
  const invite = access.isMember ? null : access.invite;
  if (event.visibility === "private" && !access.isMember && !invite) {
    const why = access.inviteProblem === "exhausted" ? "Your invitation has already been used the maximum number of times." : access.inviteProblem === "expired" ? "Your invitation has expired." : "This event is invite-only. Open the invitation link you received to register.";
    return NextResponse.json({ error: `${why} Ask the host for a new invitation.` }, { status: 403 });
  }
  if (invite?.email && invite.email !== input.email) return NextResponse.json({ error: `This invitation was sent to ${invite.email}. Register with that email address.` }, { status: 403 });
  const [tt] = await db.select().from(ticketTypes).where(and(eq(ticketTypes.id, input.ticketTypeId), eq(ticketTypes.eventId, event.id))).limit(1);
  if (!tt) return NextResponse.json({ error: "That ticket isn't available." }, { status: 404 });
  const now = new Date();
  if ((tt.salesStartAt && tt.salesStartAt > now) || (tt.salesEndAt && tt.salesEndAt < now)) return NextResponse.json({ error: "Sales for this ticket are closed." }, { status: 409 });

  // a waitlist offer unlocks exactly one seat of one ticket type for the person it was made to
  const offer = event.waitlistEnabled ? await waitlistOffer(event.id, now) : null;
  if (offer) {
    if (offer.email !== input.email) return NextResponse.json({ error: `This reserved spot is for ${offer.email}. Register with that email address.` }, { status: 403 });
    if (offer.ticketTypeId !== tt.id) return NextResponse.json({ error: "Your reserved spot is for a different ticket type." }, { status: 400 });
    if (input.guests.length > 0) return NextResponse.json({ error: "A waitlist spot covers one person; guests can join the waitlist separately." }, { status: 400 });
  }
  if (input.guests.length > 0 && !event.guestsEnabled) return NextResponse.json({ error: "This event doesn't allow guests." }, { status: 400 });
  if (input.guests.length > event.maxGuests) return NextResponse.json({ error: `You can bring up to ${event.maxGuests} guest${event.maxGuests === 1 ? "" : "s"}.` }, { status: 400 });
  const quantity = 1 + input.guests.length;
  if (quantity < tt.minPerOrder || quantity > tt.maxPerOrder) return NextResponse.json({ error: `Choose between ${tt.minPerOrder} and ${tt.maxPerOrder} tickets.` }, { status: 400 });

  // every email in the party must be distinct
  const emails = [input.email, ...input.guests.map((g) => g.email).filter((e): e is string => !!e)];
  if (new Set(emails).size !== emails.length) return NextResponse.json({ error: "Each guest needs their own email address, or none." }, { status: 400 });

  // server-side validation of custom fields with the same schema the browser used
  const fields = await db.select().from(registrationFields).where(eq(registrationFields.eventId, event.id));
  const att = buildAnswersSchema(fields, { scope: "attendee", ticketTypeId: tt.id }).safeParse(input.attendee);
  const ord = buildAnswersSchema(fields, { scope: "order" }).safeParse(input.order);
  const guestSchema = buildAnswersSchema(fields, { scope: "guest", ticketTypeId: tt.id });
  const guests = input.guests.map((g, i) => ({ ...g, parsed: guestSchema.safeParse(g.answers), index: i }));
  const issues = [
    ...(att.success ? [] : att.error.issues),
    ...(ord.success ? [] : ord.error.issues),
    ...guests.flatMap((g) => (g.parsed.success ? [] : g.parsed.error.issues.map((is) => ({ ...is, path: ["guests", g.index, ...is.path] })))),
  ];
  if (!att.success || !ord.success || issues.length) return NextResponse.json({ error: "Some answers need attention.", issues }, { status: 400 });

  // `file` answers are object keys. The schema proved the shape and the event; confirm the object
  // exists in our prefix with an allowed type before storing a key the dashboard will link to.
  const fileAnswers = fields.filter((f) => f.type === "file").flatMap((f) => [
    ...(att.data[f.key] ? [{ key: att.data[f.key], path: [f.key] }] : []),
    ...(ord.data[f.key] ? [{ key: ord.data[f.key], path: [f.key] }] : []),
    ...guests.flatMap((g) => (g.parsed.success && g.parsed.data[f.key] ? [{ key: g.parsed.data[f.key], path: ["guests", g.index, f.key] }] : [])),
  ]);
  const missingFiles = (await Promise.all(fileAnswers.map(async (a) => ((await verifyRegistrationFile(a.key, event.id)) ? null : a))))
    .filter((a): a is (typeof fileAnswers)[number] => a !== null);
  if (missingFiles.length) {
    return NextResponse.json({
      error: "Some answers need attention.",
      issues: missingFiles.map((a) => ({ code: "custom", message: "Upload the file again", path: a.path })),
    }, { status: 400 });
  }

  const [org] = await db.select().from(organizations).where(eq(organizations.id, event.organizationId)).limit(1);
  const edition = currentEdition();
  const stripeAccountId = checkoutStripeAccount(edition, org?.stripeAccountId);
  const fees = computeOrder([{ unitPriceMinor: tt.priceMinor, quantity, taxRateBps: tt.taxRateBps }], { edition, feePassThrough: event.feePassThrough });
  const isFree = fees.totalMinor === 0;
  if (!isFree && !paymentsConfigured(env.STRIPE_SECRET_KEY, env.STRIPE_PUBLISHABLE_KEY)) return NextResponse.json({ error: "This event can't take payments yet. Contact the host." }, { status: 503 });
  const orderId = newId();
  const holdExpiresAt = isFree ? null : new Date(now.getTime() + HOLD_MINUTES * 60_000);
  const status = event.requiresApproval ? ("pending_approval" as const) : ("confirmed" as const);

  const result = await db.transaction(async (tx) => {
    // one live registration per email per event (cancelled/rejected attendees and dead orders don't count)
    const [dup] = await tx.select({ email: attendees.email }).from(attendees)
      .innerJoin(orders, eq(attendees.orderId, orders.id))
      .where(and(
        eq(attendees.eventId, event.id), inArray(attendees.email, emails), isNull(attendees.deletedAt),
        notInArray(attendees.status, ["cancelled", "rejected"]), notInArray(orders.status, ["expired", "failed", "refunded"]),
      ))
      .limit(1);
    if (dup) return { duplicate: dup.email };
    if (invite && !(await consumeEventInvite(tx, invite.id, now))) return { inviteExhausted: true as const };
    // the offer's held seat is released here so the reservation below can take it
    if (offer && !(await consumeWaitlistOffer(tx, offer.id, orderId, now))) return { offerLapsed: true as const };
    // event-level capacity (locks the event row); ticket-type quantity is enforced by the conditional UPDATE below
    if (!(await capacityAllows(tx, event.id, quantity, { now }))) return { soldOut: true as const };

    // atomic inventory reservation
    const reserve = await tx.update(ticketTypes)
      .set(isFree ? { sold: sql`${ticketTypes.sold} + ${quantity}` } : { held: sql`${ticketTypes.held} + ${quantity}` })
      .where(and(
        eq(ticketTypes.id, tt.id),
        tt.quantity == null ? sql`1=1` : sql`${ticketTypes.sold} + ${ticketTypes.held} + ${quantity} <= ${ticketTypes.quantity}`,
      ));
    if (reserve[0].affectedRows === 0) return { soldOut: true as const };

    await tx.insert(orders).values({
      id: orderId, eventId: event.id, organizationId: event.organizationId, email: input.email,
      status: isFree ? "free" : "pending", currency: tt.currency,
      subtotalMinor: fees.subtotalMinor, taxMinor: fees.taxMinor, serviceFeeMinor: fees.serviceFeeMinor,
      totalMinor: fees.totalMinor, platformFeeMinor: fees.platformFeeMinor,
      holdExpiresAt,
      paidAt: isFree ? now : null, answers: ord.data, stripeAccountId,
    });
    await tx.insert(orderItems).values({ id: newId(), orderId, ticketTypeId: tt.id, quantity, unitPriceMinor: tt.priceMinor });
    const hostId = newId();
    await tx.insert(attendees).values({
      id: hostId, eventId: event.id, orderId, ticketTypeId: tt.id, name: input.name, email: input.email,
      phone: input.phone || null, smsOptIn: Boolean(input.smsOptIn && input.phone), status, answers: att.data,
    });
    if (guests.length) {
      await tx.insert(attendees).values(guests.map((g) => ({
        id: newId(), eventId: event.id, orderId, ticketTypeId: tt.id, guestOfAttendeeId: hostId,
        name: g.name, email: g.email || input.email, status, answers: g.parsed.success ? g.parsed.data : {},
      })));
    }
    return { ok: true as const };
  });
  if ("duplicate" in result) {
    const who = result.duplicate === input.email ? "This email is" : `${result.duplicate} is`;
    return NextResponse.json({ error: `${who} already registered for this event.` }, { status: 409 });
  }
  if ("offerLapsed" in result) return NextResponse.json({ error: "Your reserved spot expired. If another opens up, the host can offer it to you again." }, { status: 409 });
  if ("inviteExhausted" in result) return NextResponse.json({ error: "This invitation has already been used the maximum number of times." }, { status: 409 });
  if ("soldOut" in result) return NextResponse.json({ error: quantity > 1 ? "Not enough tickets left for your whole party." : "That ticket just sold out." }, { status: 409 });

  if (isFree) {
    await fulfilFreeOrder(orderId);
    return NextResponse.json({ orderId });
  }

  let pi;
  try {
    pi = await createOrderPaymentIntent({
      orderId, amountMinor: fees.totalMinor, currency: tt.currency, platformFeeMinor: fees.platformFeeMinor,
      stripeAccountId, receiptEmail: input.email,
    });
  } catch (e) {
    captureError("orders.createPaymentIntent", e, { eventId: event.id });
    await releaseOrder(orderId, "failed"); // give the hold back, don't strand inventory
    return NextResponse.json({ error: "Payments are unavailable right now. Please try again in a few minutes." }, { status: 503 });
  }
  if (!pi.client_secret) {
    await releaseOrder(orderId, "failed");
    return NextResponse.json({ error: "Payments are unavailable right now. Please try again in a few minutes." }, { status: 503 });
  }
  await db.update(orders).set({ stripePaymentIntentId: pi.id }).where(eq(orders.id, orderId));
  const resumeToken = await signPaymentResume({ orderId, eventId: event.id, expiresAt: new Date(now.getTime() + 24 * 60 * 60_000) }, env.AUTH_SECRET);
  return NextResponse.json({ orderId, clientSecret: pi.client_secret, stripeAccountId, holdExpiresAt: holdExpiresAt!.toISOString(), resumeToken });
}
