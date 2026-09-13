import * as React from "react";
import { ButtonLink, EmailLayout, EventBlock, Para, Title, emailI18n, linkTo, type EmailBrand, type EmailEvent, type EmailI18n } from "./layout";

export type EventUpdatedProps = EmailI18n & { brand: EmailBrand; event: EmailEvent; attendeeName: string; changes: { schedule: boolean; venue: boolean } };

const variant = (c: EventUpdatedProps["changes"]): "Both" | "Schedule" | "Venue" => (c.schedule && c.venue ? "Both" : c.schedule ? "Schedule" : "Venue");

export const eventUpdatedSubject = (p: EventUpdatedProps) => emailI18n(p).t(`eventUpdated.subject${variant(p.changes)}`, { eventName: p.event.name });

export default function EventUpdated(props: EventUpdatedProps) {
  const { brand, event, attendeeName, changes } = props;
  const { locale, t } = emailI18n(props);
  const v = variant(changes);
  return (
    <EmailLayout brand={brand} locale={locale} t={t} preview={t(`eventUpdated.preview${v}`, { eventName: event.name })}>
      <Title>{t("eventUpdated.title", { eventName: event.name })}</Title>
      <Para>
        {t.rich(`eventUpdated.intro${v}`, { name: attendeeName, orgName: brand.orgName, eventName: event.name, link: linkTo(event.url) })} {t("eventUpdated.newDetails")} {t("eventUpdated.staysValid")}
      </Para>
      <EventBlock event={event} t={t} />
      <ButtonLink href={event.calendarUrl} accent={brand.accent}>{t("eventUpdated.cta")}</ButtonLink>
    </EmailLayout>
  );
}
