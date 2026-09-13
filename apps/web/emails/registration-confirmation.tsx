import * as React from "react";
import { ButtonLink, Divider, EmailLayout, EventBlock, Para, PillLink, TicketCard, Title, emailI18n, linkTo, type EmailBrand, type EmailEvent, type EmailI18n, type EmailTicket } from "./layout";

export type RegistrationConfirmationProps = EmailI18n & {
  brand: EmailBrand;
  event: EmailEvent;
  tickets: EmailTicket[];
  wallet?: { apple?: string; google?: string } | null;
};

export const registrationConfirmationSubject = (p: RegistrationConfirmationProps) =>
  emailI18n(p).t("registrationConfirmation.subject", { count: p.tickets.length, eventName: p.event.name });

export default function RegistrationConfirmation(props: RegistrationConfirmationProps) {
  const { brand, event, tickets, wallet } = props;
  const { locale, t } = emailI18n(props);
  const count = tickets.length;
  return (
    <EmailLayout brand={brand} locale={locale} t={t} preview={t("registrationConfirmation.preview", { count, eventName: event.name })}>
      <Title>{t("registrationConfirmation.title")}</Title>
      <Para>
        {t.rich("registrationConfirmation.intro", { count, eventName: event.name, link: linkTo(event.url) })} {t("registrationConfirmation.showQr")}
      </Para>
      <EventBlock event={event} t={t} />
      {tickets.map((tk) => <TicketCard key={tk.url} ticket={tk} accent={brand.accent} t={t} />)}
      <Para style={{ margin: "16px 0 0" }}>
        <PillLink href={event.calendarUrl}>{t("registrationConfirmation.addToCalendar")}</PillLink>
        {wallet?.apple && <PillLink href={wallet.apple}>Apple Wallet</PillLink>}
        {wallet?.google && <PillLink href={wallet.google}>Google Wallet</PillLink>}
      </Para>
      <Divider />
      <Para muted style={{ margin: 0, fontSize: 13 }}>
        {t("registrationConfirmation.questions", { orgName: brand.orgName })}
      </Para>
      <ButtonLink href={event.url} accent={brand.accent}>{t("registrationConfirmation.cta")}</ButtonLink>
    </EmailLayout>
  );
}
