import * as React from "react";
import { Link } from "@react-email/components";
import { ButtonLink, Divider, EmailLayout, EventBlock, Para, TicketCard, Title, colors, type EmailBrand, type EmailEvent, type EmailTicket } from "./layout";

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
      <Para muted style={{ margin: "16px 0 0", fontSize: 13 }}>
        <Link href={event.calendarUrl} style={{ color: colors.muted }}>Add to calendar</Link>
        {wallet?.apple && <> · <Link href={wallet.apple} style={{ color: colors.muted }}>Apple Wallet</Link></>}
        {wallet?.google && <> · <Link href={wallet.google} style={{ color: colors.muted }}>Google Wallet</Link></>}
        {" · "}<Link href={event.url} style={{ color: colors.muted }}>Event page</Link>
      </Para>
      <Divider />
      <Para muted style={{ margin: 0, fontSize: 13 }}>
        Questions about the event? Reply to this email to reach {brand.orgName}.
      </Para>
      <ButtonLink href={event.url} accent={brand.accent}>See event details</ButtonLink>
    </EmailLayout>
  );
}
