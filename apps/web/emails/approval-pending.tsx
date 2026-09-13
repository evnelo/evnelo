import * as React from "react";
import { EmailLayout, EventBlock, Para, Title, emailI18n, linkTo, type EmailBrand, type EmailEvent, type EmailI18n } from "./layout";

export type ApprovalPendingProps = EmailI18n & { brand: EmailBrand; event: EmailEvent; attendeeName: string; partySize: number };

export const approvalPendingSubject = (p: ApprovalPendingProps) => emailI18n(p).t("approvalPending.subject", { eventName: p.event.name });

export default function ApprovalPending(props: ApprovalPendingProps) {
  const { brand, event, attendeeName, partySize } = props;
  const { locale, t } = emailI18n(props);
  return (
    <EmailLayout brand={brand} locale={locale} t={t} preview={t("approvalPending.preview", { orgName: brand.orgName, eventName: event.name })}>
      <Title>{t("approvalPending.title")}</Title>
      <Para>
        {t.rich("approvalPending.intro", { name: attendeeName, orgName: brand.orgName, eventName: event.name, link: linkTo(event.url) })}
        {partySize > 1 ? <> {t("approvalPending.partySize", { count: partySize })}</> : null} {t("approvalPending.approved", { count: partySize })}
      </Para>
      <EventBlock event={{ ...event, onlineUrl: null }} t={t} />
      <Para muted style={{ margin: 0, fontSize: 13 }}>{t("approvalPending.nothingToDo")}</Para>
    </EmailLayout>
  );
}
