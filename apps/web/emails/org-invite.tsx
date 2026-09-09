import * as React from "react";
import { ButtonLink, EmailLayout, Para, Title, type EmailBrand } from "./layout";

export type OrgInviteProps = { brand: EmailBrand; url: string; orgName: string; role: string; invitedBy?: string | null };
export const orgInviteSubject = (p: OrgInviteProps) => `You're invited to ${p.orgName} on OpenTicket`;

export default function OrgInvite({ brand, url, orgName, role, invitedBy }: OrgInviteProps) {
  return (
    <EmailLayout brand={brand} preview={`Join ${orgName} as ${role}.`}>
      <Title>Join {orgName}</Title>
      <Para>{invitedBy ? `${invitedBy} invited you` : "You've been invited"} to help run events for <strong>{orgName}</strong> as <strong>{role}</strong>.</Para>
      <ButtonLink href={url}>Accept invitation</ButtonLink>
      <Para muted style={{ margin: "20px 0 0", fontSize: 13 }}>The link is valid for 14 days and only works with the email address it was sent to.</Para>
    </EmailLayout>
  );
}
