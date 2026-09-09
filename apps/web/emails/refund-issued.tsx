import * as React from "react";
import { Link } from "@react-email/components";
import { EmailLayout, Para, Title, colors, type EmailBrand, type EmailEvent } from "./layout";

export type RefundIssuedProps = { brand: EmailBrand; event: EmailEvent; attendeeName: string; amount: string; ticketCount: number };

export const refundIssuedSubject = (p: RefundIssuedProps) => `Refund of ${p.amount} for ${p.event.name}`;

export default function RefundIssued({ brand, event, attendeeName, amount, ticketCount }: RefundIssuedProps) {
  return (
    <EmailLayout brand={brand} preview={`${amount} is on its way back to your card.`}>
      <Title>Refund issued</Title>
      <Para>
        Hi {attendeeName}, {brand.orgName} refunded <strong>{amount}</strong> for your order to <Link href={event.url} style={{ color: colors.accent }}>{event.name}</Link>.
        {ticketCount > 1 ? ` All ${ticketCount} tickets on the order are cancelled` : " Your ticket is cancelled"} and will no longer scan.
      </Para>
      <Para muted style={{ margin: 0, fontSize: 13 }}>
        Refunds usually reach your card in 5 to 10 business days, depending on your bank. This email is your receipt.
      </Para>
    </EmailLayout>
  );
}
