import * as React from "react";
import { EmailLayout, Para, Title, emailI18n, strong, type EmailBrand, type EmailEvent, type EmailI18n } from "./layout";

export type EventCancelledProps = EmailI18n & { brand: EmailBrand; event: EmailEvent; attendeeName: string; paid: boolean };
export const eventCancelledSubject = (p: EventCancelledProps) => emailI18n(p).t("eventCancelled.subject", { eventName: p.event.name });

export default function EventCancelled(props: EventCancelledProps) {
  const { brand, event, attendeeName, paid } = props;
  const { locale, t } = emailI18n(props);
  return (
    <EmailLayout brand={brand} locale={locale} t={t} preview={t("eventCancelled.preview", { eventName: event.name })}>
      <Title>{t("eventCancelled.title", { eventName: event.name })}</Title>
      <Para>{t.rich("eventCancelled.intro", { name: attendeeName, orgName: brand.orgName, eventName: event.name, when: event.when, strong })} {t("eventCancelled.noLongerValid")}</Para>
      <Para>{paid ? t("eventCancelled.refund") : t("eventCancelled.noPayment")}</Para>
      <Para muted style={{ margin: 0, fontSize: 13 }}>{t("eventCancelled.questions")}</Para>
    </EmailLayout>
  );
}
