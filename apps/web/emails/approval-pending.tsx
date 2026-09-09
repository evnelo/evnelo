import * as React from "react";
import { Link } from "@react-email/components";
import { EmailLayout, EventBlock, Para, Title, colors, type EmailBrand, type EmailEvent } from "./layout";

export type ApprovalPendingProps = { brand: EmailBrand; event: EmailEvent; attendeeName: string; partySize: number };

export const approvalPendingSubject = (p: ApprovalPendingProps) => `Request received for ${p.event.name}`;

export default function ApprovalPending({ brand, event, attendeeName, partySize }: ApprovalPendingProps) {
  return (
    <EmailLayout brand={brand} preview={`${brand.orgName} is reviewing your request to join ${event.name}.`}>
      <Title>Request received</Title>
      <Para>
        Hi {attendeeName}, {brand.orgName} reviews every registration for <Link href={event.url} style={{ color: colors.accent }}>{event.name}</Link>.
        {partySize > 1 ? ` Your request covers ${partySize} people.` : ""} You'll get {partySize > 1 ? "your tickets" : "your ticket"} by email as soon as it's approved.
      </Para>
      <EventBlock event={{ ...event, onlineUrl: null }} />
      <Para muted style={{ margin: 0, fontSize: 13 }}>Nothing to do for now. If your plans change, just ignore this email.</Para>
    </EmailLayout>
  );
}
