import * as React from "react";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Flag } from "lucide-react";
import { createEventReport, eventReportInput } from "@evnelo/core/services";
import { events, organizations } from "@evnelo/db";
import { db } from "@/lib/db";
import { emailConfigured, env } from "@/lib/env";
import { clientAddressFromHeaders } from "@/lib/api-http";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { CAPTCHA_FIELD, verifyCaptcha } from "@/lib/captcha";
import { CaptchaField } from "@/components/captcha";
import { captureError } from "@/lib/observability";
import { emailTranslator, renderEmail, sendEmail } from "@/lib/email";
import { DEFAULT_LOCALE } from "@/i18n/locales";
import { publicEventPath } from "@/lib/urls";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form-field";
import { NarrowPage } from "@/components/narrow-page";
import AbuseReport, { abuseReportSubject } from "@/emails/abuse-report";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.report");
  return { title: t("meta.title"), robots: "noindex,nofollow" };
}

/** Option values; the labels live in public.json under report.reasons. */
const REASON_IDS = ["spam", "scam", "inappropriate", "copyright", "other"] as const;

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ event?: string; sent?: string; error?: string }> }) {
  const { event: eventId, sent, error } = await searchParams;
  const [t, tc] = await Promise.all([getTranslations("public.report"), getTranslations("common")]);
  const [row] = eventId && eventId.length === 26
    ? await db.select({ id: events.id, name: events.name, slug: events.slug, orgSlug: organizations.slug, orgName: organizations.name }).from(events).innerJoin(organizations, eq(organizations.id, events.organizationId)).where(eq(events.id, eventId)).limit(1)
    : [];

  async function submit(formData: FormData) {
    "use server";
    const parsed = eventReportInput.safeParse({ eventId: formData.get("eventId"), reason: formData.get("reason"), details: formData.get("details") ?? "", reporterEmail: formData.get("reporterEmail") ?? "" });
    if (!parsed.success) redirect(`/report?event=${encodeURIComponent(String(formData.get("eventId") ?? ""))}&error=invalid`);
    const client = clientAddressFromHeaders(await headers());
    const allowed = await Promise.all([client ? consumeSharedRateLimit("report:client", client, 5, 60 * 60_000) : true, consumeSharedRateLimit("report:event", parsed.data.eventId, 50, 60 * 60_000)]);
    if (allowed.includes(false)) redirect(`/report?event=${parsed.data.eventId}&error=limited`);
    if (!(await verifyCaptcha(formData.get(CAPTCHA_FIELD), "report", client))) redirect(`/report?event=${parsed.data.eventId}&error=captcha`);
    const [target] = await db.select({ id: events.id, name: events.name, slug: events.slug, orgSlug: organizations.slug, orgName: organizations.name }).from(events).innerJoin(organizations, eq(organizations.id, events.organizationId)).where(eq(events.id, parsed.data.eventId)).limit(1);
    if (!target) redirect(`/report?error=invalid`);
    await createEventReport(db, parsed.data);
    if (env.ABUSE_EMAIL && emailConfigured) {
      // this one goes to whoever runs the instance, not to the reporter: keep it in the default language
      const ta = await getTranslations({ locale: DEFAULT_LOCALE, namespace: "public.report" });
      const reason = REASON_IDS.find((id) => id === parsed.data.reason);
      const props = { ...(await emailTranslator(DEFAULT_LOCALE)), brand: { orgName: "Evnelo", appUrl: env.APP_URL }, eventName: target.name, eventUrl: `${env.APP_URL}${publicEventPath(target.orgSlug, target.slug)}`, orgName: target.orgName, reason: reason ? ta(`reasons.${reason}`) : parsed.data.reason, details: parsed.data.details || null, reporterEmail: parsed.data.reporterEmail || null };
      try {
        const { html, text } = await renderEmail(React.createElement(AbuseReport, props));
        await sendEmail({ to: env.ABUSE_EMAIL, subject: abuseReportSubject(props), html, text, replyTo: parsed.data.reporterEmail || undefined });
      } catch (e) { captureError("reports.email", e, { eventId: target.id }); }
    }
    redirect(`/report?event=${target.id}&sent=1`);
  }

  const description = !row
    ? (error === "invalid" ? t("notFound") : t("openFromEvent"))
    : sent
      ? <span className="text-foreground">{t.rich(env.ABUSE_EMAIL ? "sentAndForwarded" : "sent", { name: row.name, b: (chunks) => <strong>{chunks}</strong> })}</span>
      : t.rich("reporting", { name: row.name, org: row.orgName, b: (chunks) => <strong className="text-foreground">{chunks}</strong> });

  return (
    <NarrowPage icon={<Flag />} eyebrow={t("eyebrow")} title={t("title")} description={description}>
      {row && !sent && (
        <>
          {error === "limited" && <div className="mb-4"><FormMessage error={t("errors.limited")} /></div>}
          {error === "invalid" && <div className="mb-4"><FormMessage error={t("errors.invalid")} /></div>}
          {error === "captcha" && <div className="mb-4"><FormMessage error={tc("errors.captcha")} /></div>}
          <form action={submit} className="space-y-5">
            <input type="hidden" name="eventId" value={row.id} />
            <div><Label htmlFor="reason">{t("form.reason")}</Label><Select id="reason" name="reason" className="mt-1.5 h-11" defaultValue="spam">{REASON_IDS.map((id) => <option key={id} value={id}>{t(`reasons.${id}`)}</option>)}</Select></div>
            <div><Label htmlFor="details">{t("form.details")} <span className="font-normal text-muted-foreground">{t("form.optional")}</span></Label><Textarea id="details" name="details" rows={4} maxLength={2000} className="mt-1.5" /></div>
            <div><Label htmlFor="reporterEmail">{t("form.email")} <span className="font-normal text-muted-foreground">{t("form.optionalFollowUp")}</span></Label><Input id="reporterEmail" name="reporterEmail" type="email" className="mt-1.5 h-11" /></div>
            <CaptchaField action="report" />
            <SubmitButton size="lg">{t("form.submit")}</SubmitButton>
          </form>
        </>
      )}
      {row && sent && (
        <Button asChild variant="outline" size="lg"><a href={publicEventPath(row.orgSlug, row.slug)}>{t("back")}</a></Button>
      )}
    </NarrowPage>
  );
}
