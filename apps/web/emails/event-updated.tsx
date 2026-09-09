import * as React from "react";
import { Link } from "@react-email/components";
import { ButtonLink, EmailLayout, EventBlock, Para, Title, colors, type EmailBrand, type EmailEvent } from "./layout";

export type EventUpdatedProps = { brand: EmailBrand; event: EmailEvent; attendeeName: string; changes: { schedule: boolean; venue: boolean } };
export const eventUpdatedSubject = (p: EventUpdatedProps) =>
  p.changes.schedule && p.changes.venue ? `New time and place for ${p.event.name}` : p.changes.schedule ? `New time for ${p.event.name}` : `New location for ${p.event.name}`;

export default function EventUpdated({ brand, event, attendeeName, changes }: EventUpdatedProps) {
  const what = changes.schedule && changes.venue ? "the time and the place" : changes.schedule ? "the time" : "the place";
  return (
    <EmailLayout brand={brand} preview={`${event.name} has changed ${what}.`}>
      <Title>{event.name} has changed</Title>
      <Para>Hi {attendeeName}, {brand.orgName} updated {what} for <Link href={event.url} style={{ color: colors.accent }}>{event.name}</Link>. Here are the new details. Your ticket stays valid.</Para>
      <EventBlock event={event} />
      <ButtonLink href={event.calendarUrl} accent={brand.accent}>Update my calendar</ButtonLink>
    </EmailLayout>
  );
}
