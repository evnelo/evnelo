import * as React from "react";
import { ButtonLink, EmailLayout, Para, Title, type EmailBrand } from "./layout";

export type AbuseReportProps = { brand: EmailBrand; eventName: string; eventUrl: string; orgName: string; reason: string; details: string | null; reporterEmail: string | null };
export const abuseReportSubject = (p: AbuseReportProps) => `[Report] ${p.reason}: ${p.eventName}`;

export default function AbuseReport({ brand, eventName, eventUrl, orgName, reason, details, reporterEmail }: AbuseReportProps) {
  return (
    <EmailLayout brand={brand} preview={`Someone reported ${eventName}.`}>
      <Title>Event reported</Title>
      <Para><strong>{eventName}</strong> by {orgName} was reported for <strong>{reason}</strong>.</Para>
      {details && <Para style={{ whiteSpace: "pre-wrap" }}>{details}</Para>}
      <Para muted>{reporterEmail ? `Reporter: ${reporterEmail}` : "The reporter did not leave an email."}</Para>
      <ButtonLink href={eventUrl}>Open the event</ButtonLink>
    </EmailLayout>
  );
}
