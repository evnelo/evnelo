import * as React from "react";
import { ButtonLink, EmailLayout, Para, Title, type EmailBrand } from "./layout";

export type WaitlistJoinedProps = { brand: EmailBrand; eventName: string; eventUrl: string; position: number };
export const waitlistJoinedSubject = (p: WaitlistJoinedProps) => `You're on the waitlist for ${p.eventName}`;

export default function WaitlistJoined({ brand, eventName, eventUrl, position }: WaitlistJoinedProps) {
  return (
    <EmailLayout brand={brand} preview={`You're number ${position} on the waitlist.`}>
      <Title>You&rsquo;re on the waitlist</Title>
      <Para><strong>{eventName}</strong> is full right now. You are number <strong>{position}</strong> in line. If a spot opens up, we&rsquo;ll email you a link to claim it; the link stays valid for 24 hours.</Para>
      <ButtonLink href={eventUrl} accent={brand.accent}>View event</ButtonLink>
    </EmailLayout>
  );
}
