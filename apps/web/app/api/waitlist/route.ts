import * as React from "react";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { joinWaitlist, waitlistJoinInput } from "@evnelo/core/services";
import { events, organizations } from "@evnelo/db";
import { db } from "@/lib/db";
import { emailConfigured, env } from "@/lib/env";
import { clientAddress, readJsonBody } from "@/lib/api-http";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { requestLocale } from "@/lib/locale";
import { verifyCaptcha } from "@/lib/captcha";
import { captureError } from "@/lib/observability";
import { emailTranslator, renderEmail, sendEmail } from "@/lib/email";
import { publicEventPath } from "@/lib/urls";
import WaitlistJoined, { waitlistJoinedSubject } from "@/emails/waitlist-joined";

export const runtime = "nodejs";

const input = waitlistJoinInput.extend({ eventId: z.string().length(26), captchaToken: z.string().max(4_096).optional() });

/** Join the waitlist of a sold-out event. Idempotent per email. */
export async function POST(request: Request) {
  const [t, tc] = await Promise.all([getTranslations("event"), getTranslations("common")]);
  const parsed = input.safeParse(await readJsonBody(request, 8_192).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t("errors.waitlistInput") }, { status: 400 });
  const { eventId, captchaToken, ...form } = parsed.data;
  const address = clientAddress(request);
  const allowed = await Promise.all([
    address ? consumeSharedRateLimit("waitlist:client", address, 10, 10 * 60_000) : true,
    consumeSharedRateLimit("waitlist:email", form.email, 5, 10 * 60_000),
    consumeSharedRateLimit("waitlist:event", eventId, 600, 60_000),
  ]);
  if (allowed.includes(false)) return NextResponse.json({ error: t("errors.tooManyAttempts") }, { status: 429, headers: { "Retry-After": "60" } });
  if (!(await verifyCaptcha(captchaToken, "waitlist", address))) return NextResponse.json({ error: tc("errors.captcha") }, { status: 400 });

  const [row] = await db.select({ event: events, org: organizations }).from(events).innerJoin(organizations, eq(organizations.id, events.organizationId)).where(eq(events.id, eventId)).limit(1);
  if (!row || row.event.status !== "published" || row.event.deletedAt) return NextResponse.json({ error: t("errors.eventNotOpen") }, { status: 404 });
  if (!row.event.waitlistEnabled) return NextResponse.json({ error: t("errors.noWaitlist") }, { status: 400 });

  const locale = requestLocale(request);
  const result = await joinWaitlist(db, eventId, { ...form, locale });
  if (result.outcome === "registered") return NextResponse.json({ error: t("errors.alreadyRegistered") }, { status: 409 });
  if (result.outcome === "joined" && emailConfigured) {
    const { event, org } = row;
    const props = { ...(await emailTranslator(locale)), brand: { orgName: org.name, orgLogoUrl: org.logoUrl, accent: org.accentColor, appUrl: env.APP_URL }, eventName: event.name, eventUrl: `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`, position: result.position };
    try {
      const { html, text } = await renderEmail(React.createElement(WaitlistJoined, props));
      await sendEmail({ to: form.email, subject: waitlistJoinedSubject(props), html, text });
    } catch (e) {
      captureError("waitlist.joinedEmail", e, { eventId });
    }
  }
  return NextResponse.json({ ok: true, already: result.outcome === "already" });
}
