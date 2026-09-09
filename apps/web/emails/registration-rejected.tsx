import * as React from "react";
import { Link } from "@react-email/components";
import { EmailLayout, Para, Title, colors, type EmailBrand, type EmailEvent } from "./layout";

export type RegistrationRejectedProps = { brand: EmailBrand; event: EmailEvent; attendeeName: string; paid: boolean };
export const registrationRejectedSubject = (p: RegistrationRejectedProps) => `Update on your request for ${p.event.name}`;

export default function RegistrationRejected({ brand, event, attendeeName, paid }: RegistrationRejectedProps) {
  return (
    <EmailLayout brand={brand} preview={`${brand.orgName} couldn't approve your registration for ${event.name}.`}>
      <Title>We couldn't fit you in</Title>
      <Para>Hi {attendeeName}, {brand.orgName} wasn't able to approve your registration for <Link href={event.url} style={{ color: colors.accent }}>{event.name}</Link>. {paid ? "Any payment will be refunded to your card." : "No payment was taken."}</Para>
      <Para muted style={{ margin: 0, fontSize: 13 }}>Questions? Reply to this email to reach the organizer.</Para>
    </EmailLayout>
  );
}
