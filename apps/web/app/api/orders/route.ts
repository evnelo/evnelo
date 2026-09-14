import { captureError } from "@/lib/observability";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { attendees, events, orders, orderItems, organizations, registrationFields, ticketTypes } from "@evnelo/db";
import { buildAnswersSchema, computeOrder, currentEdition, newId } from "@evnelo/core";
import { capacityAllows, claimRegistrationUploads, consumeDiscountCode, consumeEventInvite, consumeWaitlistOffer, discountProblem, findDiscountCode, markVisitMilestone, toDiscount, newAccessToken, utcDay, visitorHash } from "@evnelo/core/services";
import { eventAccess } from "@/lib/event-access";
import { waitlistOffer } from "@/lib/waitlist-access";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createOrderPaymentIntent } from "@/lib/stripe";
import { connectedAccountStatus } from "@/lib/stripe-connect";
import { ensureApplePayDomainOnce } from "@/lib/apple-pay";
import { fulfilFreeOrder, releaseOrder } from "@/lib/orders";
import { checkoutStripeAccount, paymentsConfigured } from "@/lib/payment-flow";
import { signPaymentResume } from "@/lib/payment-resume";
import { orderPath } from "@/lib/urls";
import { clientAddress } from "@/lib/api-http";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { verifyCaptcha } from "@/lib/captcha";
import { verifyRegistrationFile } from "@/lib/storage";
import { requestLocale } from "@/lib/locale";
import { EVENTS } from "@/lib/analytics-events";
import { track } from "@/lib/posthog-server";

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
  discountCode: z.string().trim().max(40).optional().or(z.literal("")),
  captchaToken: z.string().max(4_096).optional(),
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
  const [t, tc] = await Promise.all([getTranslations("event"), getTranslations("common")]);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t("errors.checkForm"), issues: parsed.error.issues }, { status: 400 });
  const input = parsed.data;

  // Abuse limits: per client when a trusted proxy header identifies one, per email, and a per-event
  // ceiling that keeps a scripted flood from exhausting holds or the notification queue.
  const address = clientAddress(req);
  const locale = requestLocale(req); // emails to this registration follow the language it was made in
  const allowed = await Promise.all([
    address ? consumeSharedRateLimit("register:client", address, 10, 10 * 60_000) : true,
    consumeSharedRateLimit("register:email", input.email, 5, 10 * 60_000),
    consumeSharedRateLimit("register:event", input.eventId, 600, 60_000),
  ]);
  if (allowed.includes(false)) return NextResponse.json({ error: t("errors.tooManyRegistrations") }, { status: 429, headers: { "Retry-After": "60" } });
  if (!(await verifyCaptcha(input.captchaToken, "register", address))) return NextResponse.json({ error: tc("errors.captcha") }, { status: 400 });

  const [event] = await db.select().from(events).where(eq(events.id, input.eventId)).limit(1);
  if (!event || event.status !== "published") return NextResponse.json({ error: t("errors.notOpenForRegistration") }, { status: 404 });
  // private events: an organization member, or a valid invite cookie (set by /i/{token}); email-bound invites must match
  const access = event.visibility === "private" ? await eventAccess(event) : { isMember: false, invite: null, inviteProblem: null };
  const invite = access.isMember ? null : access.invite;
  if (event.visibility === "private" && !access.isMember && !invite) {
    const why = access.inviteProblem === "exhausted" ? t("errors.inviteExhaustedAsk") : access.inviteProblem === "expired" ? t("errors.inviteExpiredAsk") : t("errors.inviteOnlyAsk");
    return NextResponse.json({ error: why }, { status: 403 });
  }
  if (invite?.email && invite.email !== input.email) return NextResponse.json({ error: t("errors.inviteEmail", { email: invite.email }) }, { status: 403 });
  const [tt] = await db.select().from(ticketTypes).where(and(eq(ticketTypes.id, input.ticketTypeId), eq(ticketTypes.eventId, event.id))).limit(1);
  if (!tt) return NextResponse.json({ error: t("errors.ticketUnavailable") }, { status: 404 });
  const now = new Date();
  if ((tt.salesStartAt && tt.salesStartAt > now) || (tt.salesEndAt && tt.salesEndAt < now)) return NextResponse.json({ error: t("errors.salesClosed") }, { status: 409 });

  // a waitlist offer unlocks exactly one seat of one ticket type for the person it was made to
  const offer = event.waitlistEnabled ? await waitlistOffer(event.id, now) : null;
  if (offer) {
    if (offer.email !== input.email) return NextResponse.json({ error: t("errors.offerEmail", { email: offer.email }) }, { status: 403 });
    if (offer.ticketTypeId !== tt.id) return NextResponse.json({ error: t("errors.offerTicketType") }, { status: 400 });
    if (input.guests.length > 0) return NextResponse.json({ error: t("errors.offerNoGuests") }, { status: 400 });
  }
  if (input.guests.length > 0 && !event.guestsEnabled) return NextResponse.json({ error: t("errors.guestsNotAllowed") }, { status: 400 });
  if (input.guests.length > event.maxGuests) return NextResponse.json({ error: t("errors.maxGuests", { count: event.maxGuests }) }, { status: 400 });
  const quantity = 1 + input.guests.length;
  if (quantity < tt.minPerOrder || quantity > tt.maxPerOrder) return NextResponse.json({ error: t("errors.quantityRange", { min: tt.minPerOrder, max: tt.maxPerOrder }) }, { status: 400 });

  // every email in the party must be distinct
  const emails = [input.email, ...input.guests.map((g) => g.email).filter((e): e is string => !!e)];
  if (new Set(emails).size !== emails.length) return NextResponse.json({ error: t("errors.distinctEmails") }, { status: 400 });

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
  if (!att.success || !ord.success || issues.length) return NextResponse.json({ error: t("errors.answersNeedAttention"), issues }, { status: 400 });

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
      error: t("errors.answersNeedAttention"),
      issues: missingFiles.map((a) => ({ code: "custom", message: t("errors.uploadAgain"), path: a.path })),
    }, { status: 400 });
  }

  const [org] = await db.select().from(organizations).where(eq(organizations.id, event.organizationId)).limit(1);
  const edition = currentEdition();
  const stripeAccountId = checkoutStripeAccount(edition, org?.stripeAccountId);
  // discount code: validated here and spent inside the transaction; a 100% discount makes the order free
  const discountCode = input.discountCode && tt.priceMinor > 0 ? await findDiscountCode(db, event.id, input.discountCode) : null;
  if (input.discountCode && tt.priceMinor > 0) {
    const problem = discountProblem(discountCode, now);
    if (problem) return NextResponse.json({ error: t(`discount.problem.${problem}`), issues: [{ path: ["discountCode"], message: t(`discount.problem.${problem}`) }] }, { status: 400 });
  }
  const fees = computeOrder([{ unitPriceMinor: tt.priceMinor, quantity, taxRateBps: tt.taxRateBps }], { edition, feePassThrough: event.feePassThrough, discount: discountCode ? toDiscount(discountCode) : null });
  const isFree = fees.totalMinor === 0;
  if (!isFree && !paymentsConfigured(env.STRIPE_SECRET_KEY, env.STRIPE_PUBLISHABLE_KEY)) return NextResponse.json({ error: t("errors.paymentsNotConfigured") }, { status: 503 });
  if (!isFree && edition === "cloud") {
    const account = await connectedAccountStatus(stripeAccountId);
    // no account or an incomplete one is the host's to fix; only a Stripe read failure is worth retrying
    if (account !== "ready") return NextResponse.json({ error: t(account === "unavailable" ? "errors.paymentsUnavailable" : "errors.paymentsNotConfigured") }, { status: 503 });
  }
  const orderId = newId();
  const accessToken = newAccessToken();
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
    if (discountCode && !(await consumeDiscountCode(tx, discountCode.id, now))) return { discountGone: true as const };
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
      subtotalMinor: fees.subtotalMinor, discountMinor: fees.discountMinor, discountCodeId: discountCode?.id ?? null, taxMinor: fees.taxMinor, serviceFeeMinor: fees.serviceFeeMinor,
      totalMinor: fees.totalMinor, platformFeeMinor: fees.platformFeeMinor,
      holdExpiresAt,
      paidAt: isFree ? now : null, answers: ord.data, stripeAccountId, accessToken,
    });
    await tx.insert(orderItems).values({ id: newId(), orderId, ticketTypeId: tt.id, quantity, unitPriceMinor: tt.priceMinor });
    const hostId = newId();
    await tx.insert(attendees).values({
      locale,
      id: hostId, eventId: event.id, orderId, ticketTypeId: tt.id, name: input.name, email: input.email,
      phone: input.phone || null, smsOptIn: Boolean(input.smsOptIn && input.phone), status, answers: att.data,
    });
    if (guests.length) {
      await tx.insert(attendees).values(guests.map((g) => ({
        locale,
        id: newId(), eventId: event.id, orderId, ticketTypeId: tt.id, guestOfAttendeeId: hostId,
        name: g.name, email: g.email || input.email, status, answers: g.parsed.success ? g.parsed.data : {},
      })));
    }
    return { ok: true as const };
  });
  if ("duplicate" in result) {
    return NextResponse.json({ error: result.duplicate === input.email ? t("errors.alreadyRegistered") : t("errors.otherAlreadyRegistered", { email: result.duplicate ?? "" }) }, { status: 409 });
  }
  if ("discountGone" in result) return NextResponse.json({ error: t("errors.discountUsedUp") }, { status: 409 });
  if ("offerLapsed" in result) return NextResponse.json({ error: t("errors.offerLapsed") }, { status: 409 });
  if ("inviteExhausted" in result) return NextResponse.json({ error: t("errors.inviteExhausted") }, { status: 409 });
  if ("soldOut" in result) return NextResponse.json({ error: quantity > 1 ? t("errors.notEnoughTickets") : t("errors.justSoldOut") }, { status: 409 });

  // the files are now referenced by a registration: the orphan sweep must leave them alone
  if (fileAnswers.length) await claimRegistrationUploads(db, fileAnswers.map((a) => String(a.key))).catch((e) => captureError("orders.claimUploads", e, { eventId: event.id }));
  // the first-party funnel's last step; the view came in through components/visit-beacon.tsx
  {
    const day = utcDay();
    await markVisitMilestone(db, { eventId: event.id, day, visitorHash: visitorHash(env.AUTH_SECRET, day, address, req.headers.get("user-agent")) }, "registered")
      .catch((e) => captureError("orders.visitMilestone", e, { eventId: event.id }));
  }
  track(EVENTS.registrationSubmitted, { distinctId: orderId, anonymous: true, organizationId: event.organizationId, properties: { eventId: event.id, quantity, free: isFree, discount: Boolean(discountCode), requiresApproval: event.requiresApproval, edition } });
  if (isFree) {
    await fulfilFreeOrder(orderId);
    return NextResponse.json({ orderId, orderUrl: orderPath(accessToken) });
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
    return NextResponse.json({ error: t("errors.paymentsUnavailable") }, { status: 503 });
  }
  if (!pi.client_secret) {
    await releaseOrder(orderId, "failed");
    return NextResponse.json({ error: t("errors.paymentsUnavailable") }, { status: 503 });
  }
  await db.update(orders).set({ stripePaymentIntentId: pi.id }).where(eq(orders.id, orderId));
  if (stripeAccountId) ensureApplePayDomainOnce(stripeAccountId); // Apple Pay for accounts that connected before registration existed
  track(EVENTS.paymentStarted, { distinctId: orderId, anonymous: true, organizationId: event.organizationId, properties: { eventId: event.id, amountMinor: fees.totalMinor, currency: tt.currency, connected: Boolean(stripeAccountId) } });
  const resumeToken = await signPaymentResume({ orderId, eventId: event.id, expiresAt: new Date(now.getTime() + 24 * 60 * 60_000) }, env.AUTH_SECRET);
  return NextResponse.json({ orderId, clientSecret: pi.client_secret, stripeAccountId, holdExpiresAt: holdExpiresAt!.toISOString(), resumeToken });
}
