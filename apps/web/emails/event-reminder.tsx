import * as React from "react";
import { ButtonLink, Divider, EmailLayout, EventBlock, Para, TicketCard, Title, colors, emailI18n, linkTo, type EmailBrand, type EmailEvent, type EmailI18n, type EmailTicket } from "./layout";

export type EventReminderProps = EmailI18n & {
  brand: EmailBrand;
  event: EmailEvent;
  when: string; // already translated: "tomorrow", "in 1 hour" (emails.reminderWhen.*)
  tickets: EmailTicket[];
  unsubscribeUrl: string;
};

export const eventReminderSubject = (p: EventReminderProps) => emailI18n(p).t("eventReminder.subject", { eventName: p.event.name, when: p.when });

export default function EventReminder(props: EventReminderProps) {
  const { brand, event, when, tickets, unsubscribeUrl } = props;
  const { locale, t } = emailI18n(props);
  return (
    <EmailLayout
      brand={brand}
      locale={locale}
      t={t}
      preview={t("eventReminder.preview", { eventName: event.name, when, where: event.where })}
      footer={<Para muted style={{ margin: 0, fontSize: 12 }}>{t.rich("eventReminder.stopPrompt", { link: linkTo(unsubscribeUrl, { color: colors.muted }) })} {t("eventReminder.stillGetThrough")}</Para>}
    >
      <Title>{t("eventReminder.title", { eventName: event.name, when })}</Title>
      <EventBlock event={event} t={t} />
      <Para>{t("eventReminder.tickets", { count: tickets.length })}</Para>
      {tickets.map((tk) => <TicketCard key={tk.url} ticket={tk} accent={brand.accent} t={t} />)}
      <Divider />
      <ButtonLink href={event.url} accent={brand.accent}>{t("eventReminder.cta")}</ButtonLink>
    </EmailLayout>
  );
}
