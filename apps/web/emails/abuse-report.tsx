import * as React from "react";
import { ButtonLink, EmailLayout, Para, Title, emailI18n, strong, type EmailBrand, type EmailI18n } from "./layout";

/**
 * Goes to ABUSE_EMAIL, so `locale`/`t` is whatever the operator reads; the sender
 * (app/(public)/report/page.tsx) may pass the reporter's request locale. `reason` is a label the
 * caller has already translated.
 */
export type AbuseReportProps = EmailI18n & { brand: EmailBrand; eventName: string; eventUrl: string; orgName: string; reason: string; details: string | null; reporterEmail: string | null };
export const abuseReportSubject = (p: AbuseReportProps) => emailI18n(p).t("abuseReport.subject", { reason: p.reason, eventName: p.eventName });

export default function AbuseReport(props: AbuseReportProps) {
  const { brand, eventName, eventUrl, orgName, reason, details, reporterEmail } = props;
  const { locale, t } = emailI18n(props);
  return (
    <EmailLayout brand={brand} locale={locale} t={t} preview={t("abuseReport.preview", { eventName })}>
      <Title>{t("abuseReport.title")}</Title>
      <Para>{t.rich("abuseReport.intro", { eventName, orgName, reason, strong })}</Para>
      {details && <Para style={{ whiteSpace: "pre-wrap" }}>{details}</Para>}
      <Para muted>{reporterEmail ? t("abuseReport.reporter", { email: reporterEmail }) : t("abuseReport.noReporter")}</Para>
      <ButtonLink href={eventUrl}>{t("abuseReport.cta")}</ButtonLink>
    </EmailLayout>
  );
}
