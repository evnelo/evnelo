import * as React from "react";
import { EmailLayout, Para, Title, type EmailBrand, type EmailEvent } from "./layout";

export type EventCancelledProps = { brand: EmailBrand; event: EmailEvent; attendeeName: string; paid: boolean };
export const eventCancelledSubject = (p: EventCancelledProps) => `${p.event.name} has been cancelled`;

export default function EventCancelled({ brand, event, attendeeName, paid }: EventCancelledProps) {
  return (
    <EmailLayout brand={brand} preview={`${event.name} is not going ahead.`}>
      <Title>{event.name} is cancelled</Title>
      <Para>Hi {attendeeName}, {brand.orgName} has cancelled <strong>{event.name}</strong>, which was scheduled for {event.when}. Your ticket is no longer valid.</Para>
      <Para>{paid ? "Your payment will be refunded to the card you used; expect a separate email when it goes through." : "No payment was taken, so there's nothing to refund."}</Para>
      <Para muted style={{ margin: 0, fontSize: 13 }}>Questions? Reply to this email to reach the organizer.</Para>
    </EmailLayout>
  );
}
