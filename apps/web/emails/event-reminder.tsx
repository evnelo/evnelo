import * as React from "react";
import { Link } from "@react-email/components";
import { ButtonLink, Divider, EmailLayout, EventBlock, Para, TicketCard, Title, colors, type EmailBrand, type EmailEvent, type EmailTicket } from "./layout";

export type EventReminderProps = {
  brand: EmailBrand;
  event: EmailEvent;
  when: string; // "tomorrow", "in 1 hour"
  tickets: EmailTicket[];
  unsubscribeUrl: string;
};

export const eventReminderSubject = (p: EventReminderProps) => `${p.event.name} is ${p.when}`;

export default function EventReminder({ brand, event, when, tickets, unsubscribeUrl }: EventReminderProps) {
  return (
    <EmailLayout
      brand={brand}
      preview={`${event.name} is ${when}. ${event.where}.`}
      footer={<Para muted style={{ margin: 0, fontSize: 12 }}>Don't want reminders for this event? <Link href={unsubscribeUrl} style={{ color: colors.muted }}>Stop reminders</Link>. Confirmations and changes still get through.</Para>}
    >
      <Title>{event.name} is {when}</Title>
      <EventBlock event={event} />
      <Para>{tickets.length > 1 ? "Your tickets, ready to scan:" : "Your ticket, ready to scan:"}</Para>
      {tickets.map((t) => <TicketCard key={t.url} ticket={t} accent={brand.accent} />)}
      <Divider />
      <ButtonLink href={event.url} accent={brand.accent}>Event details and directions</ButtonLink>
    </EmailLayout>
  );
}
