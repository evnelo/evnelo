import * as React from "react";
import { EmailLayout, Para, Title, emailI18n, linkTo, strong, type EmailBrand, type EmailEvent, type EmailI18n } from "./layout";

/** `amount` arrives pre-formatted in the recipient's locale (formatMoney(minor, currency, locale)). */
export type RefundIssuedProps = EmailI18n & { brand: EmailBrand; event: EmailEvent; attendeeName: string; amount: string; ticketCount: number };

export const refundIssuedSubject = (p: RefundIssuedProps) => emailI18n(p).t("refundIssued.subject", { amount: p.amount, eventName: p.event.name });

export default function RefundIssued(props: RefundIssuedProps) {
  const { brand, event, attendeeName, amount, ticketCount } = props;
  const { locale, t } = emailI18n(props);
  return (
    <EmailLayout brand={brand} locale={locale} t={t} preview={t("refundIssued.preview", { amount })}>
      <Title>{t("refundIssued.title")}</Title>
      <Para>
        {t.rich("refundIssued.intro", { name: attendeeName, orgName: brand.orgName, amount, eventName: event.name, strong, link: linkTo(event.url) })} {t("refundIssued.cancelled", { count: ticketCount })}
      </Para>
      <Para muted style={{ margin: 0, fontSize: 13 }}>
        {t("refundIssued.timing")} {t("refundIssued.receipt")}
      </Para>
    </EmailLayout>
  );
}
