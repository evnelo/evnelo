import * as React from "react";
import { ButtonLink, EmailLayout, EventBlock, Para, Title, type EmailBrand, type EmailEvent } from "./layout";

export type EventInviteProps = { brand: EmailBrand; event: EmailEvent; url: string; expires?: string | null };
export const eventInviteSubject = (p: EventInviteProps) => `You're invited: ${p.event.name}`;

export default function EventInvite({ brand, event, url, expires }: EventInviteProps) {
  return (
    <EmailLayout brand={brand} preview={`${brand.orgName} invited you to ${event.name}.`}>
      <Title>You&rsquo;re invited</Title>
      <Para><strong>{brand.orgName}</strong> is inviting you to a private event.</Para>
      <EventBlock event={{ ...event, onlineUrl: null }} />
      <ButtonLink href={url} accent={brand.accent}>View event and register</ButtonLink>
      <Para muted style={{ margin: "20px 0 0", fontSize: 13 }}>This link is personal to you{expires ? ` and expires ${expires}` : ""}. Register with this email address.</Para>
    </EmailLayout>
  );
}
