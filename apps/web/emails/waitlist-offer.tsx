import * as React from "react";
import { ButtonLink, EmailLayout, EventBlock, Para, Title, type EmailBrand, type EmailEvent } from "./layout";

export type WaitlistOfferProps = { brand: EmailBrand; event: EmailEvent; url: string; ticketTypeName: string; deadline: string };
export const waitlistOfferSubject = (p: WaitlistOfferProps) => `A spot opened up: ${p.event.name}`;

export default function WaitlistOffer({ brand, event, url, ticketTypeName, deadline }: WaitlistOfferProps) {
  return (
    <EmailLayout brand={brand} preview={`Claim your spot before ${deadline}.`}>
      <Title>A spot opened up</Title>
      <Para>Good news: a <strong>{ticketTypeName}</strong> spot for <strong>{event.name}</strong> is reserved for you. Claim it before <strong>{deadline}</strong>, after that it goes to the next person in line.</Para>
      <EventBlock event={{ ...event, onlineUrl: null }} />
      <ButtonLink href={url} accent={brand.accent}>Claim my spot</ButtonLink>
      <Para muted style={{ margin: "20px 0 0", fontSize: 13 }}>Register with this email address. The link is personal to you.</Para>
    </EmailLayout>
  );
}
