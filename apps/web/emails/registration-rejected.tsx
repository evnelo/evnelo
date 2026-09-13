import * as React from "react";
import { EmailLayout, Para, Title, emailI18n, linkTo, type EmailBrand, type EmailEvent, type EmailI18n } from "./layout";

export type RegistrationRejectedProps = EmailI18n & { brand: EmailBrand; event: EmailEvent; attendeeName: string; paid: boolean };
export const registrationRejectedSubject = (p: RegistrationRejectedProps) => emailI18n(p).t("registrationRejected.subject", { eventName: p.event.name });

export default function RegistrationRejected(props: RegistrationRejectedProps) {
  const { brand, event, attendeeName, paid } = props;
  const { locale, t } = emailI18n(props);
  return (
    <EmailLayout brand={brand} locale={locale} t={t} preview={t("registrationRejected.preview", { orgName: brand.orgName, eventName: event.name })}>
      <Title>{t("registrationRejected.title")}</Title>
      <Para>{t.rich("registrationRejected.intro", { name: attendeeName, orgName: brand.orgName, eventName: event.name, link: linkTo(event.url) })} {paid ? t("registrationRejected.refund") : t("registrationRejected.noPayment")}</Para>
      <Para muted style={{ margin: 0, fontSize: 13 }}>{t("registrationRejected.questions")}</Para>
    </EmailLayout>
  );
}
