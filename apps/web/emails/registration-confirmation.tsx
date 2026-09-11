import * as React from "react";
import { Link } from "@react-email/components";
import { ButtonLink, Divider, EmailLayout, EventBlock, Para, PillLink, TicketCard, Title, colors, type EmailBrand, type EmailEvent, type EmailTicket } from "./layout";

export type RegistrationConfirmationProps = {
  brand: EmailBrand;
  event: EmailEvent;
  tickets: EmailTicket[];
  wallet?: { apple?: string; google?: string } | null;
};

export const registrationConfirmationSubject = (p: RegistrationConfirmationProps) =>
  p.tickets.length > 1 ? `Your ${p.tickets.length} tickets for ${p.event.name}` : `Your ticket for ${p.event.name}`;

export default function RegistrationConfirmation({ brand, event, tickets, wallet }: RegistrationConfirmationProps) {
  const many = tickets.length > 1;
  return (
    <EmailLayout brand={brand} preview={`You're in for ${event.name}. ${many ? "Your tickets are" : "Your ticket is"} inside.`}>
      <Title>You're in.</Title>
      <Para>
        {many ? `Here are your ${tickets.length} tickets for` : "Here is your ticket for"} <Link href={event.url} style={{ color: colors.accent }}>{event.name}</Link>. Show the QR code at the door, on your phone or printed.
      </Para>
      <EventBlock event={event} />
      {tickets.map((t) => <TicketCard key={t.url} ticket={t} accent={brand.accent} />)}
      <Para style={{ margin: "16px 0 0" }}>
        <PillLink href={event.calendarUrl}>Add to calendar</PillLink>
        {wallet?.apple && <PillLink href={wallet.apple}>Apple Wallet</PillLink>}
        {wallet?.google && <PillLink href={wallet.google}>Google Wallet</PillLink>}
      </Para>
      <Divider />
      <Para muted style={{ margin: 0, fontSize: 13 }}>
        Questions about the event? Reply to this email to reach {brand.orgName}.
      </Para>
      <ButtonLink href={event.url} accent={brand.accent}>See event details</ButtonLink>
    </EmailLayout>
  );
}
