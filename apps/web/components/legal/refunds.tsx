import { LEGAL } from "@/lib/legal";

/** Refund Policy, English. A draft for legal review; the facts come from lib/legal.ts. */
export function RefundPolicy() {
  const { product, entity, contactEmail } = LEGAL;
  return (
    <>
      <p>Tickets on {product} are sold by the host of the event, and it is the host who decides whether a ticket can be refunded. This page explains how refunds work on the platform so attendees and hosts know what to expect.</p>

      <h2>1. The host&rsquo;s refund policy</h2>
      <p>Each event page states the host&rsquo;s refund policy. Read it before buying: a host may offer refunds until a deadline, only when the event is cancelled or moved, or not at all. That policy is part of the contract between you and the host. If it says nothing, ask the host before you buy.</p>

      <h2>2. How to ask for a refund</h2>
      <p>Contact the host. Their name and links are on the event page, and the email that carried your ticket came from them. {entity} cannot refund a ticket on a host&rsquo;s behalf, because the money was paid to the host&rsquo;s own Stripe account, not to us.</p>

      <h2>3. How a refund is paid</h2>
      <p>When a host refunds an order, the money goes back through Stripe to the payment method used, usually within 5 to 10 business days depending on the bank. A full refund cancels the order&rsquo;s tickets and the attendee receives an email confirming it. A partial refund keeps the tickets valid unless the host says otherwise.</p>

      <h2>4. Fees</h2>
      <p>Stripe&rsquo;s processing fees are charged by Stripe and are not returned on a refund. {product}&rsquo;s platform fee of 0.99% is charged to the host per ticket sold and is not returned when the host refunds an order. If the host passed a service fee on to the attendee, that amount is part of the order and is refunded with it.</p>

      <h2>5. Cancelled or changed events</h2>
      <p>If a host cancels an event, they are expected to refund every ticket. {product} notifies attendees of a cancellation and of changes to the date or venue. If a host does not refund a cancelled event, attendees can dispute the charge with their bank; we will provide Stripe and the bank with the order records.</p>

      <h2>6. Chargebacks</h2>
      <p>Please contact the host before disputing a charge with your bank. When a bank dispute is opened, the ticket is revoked while the dispute is open, and a dispute that is decided against the host costs them the ticket amount plus a fee from the bank. Disputes that are found to be unwarranted may lead us to close the attendee&rsquo;s access to the platform.</p>

      <h2>7. Free events</h2>
      <p>Registrations for free events can be cancelled by the host from the dashboard; there is nothing to refund. If you can no longer attend, tell the host so the seat can go to someone else.</p>

      <h2>8. Contact</h2>
      <p>For questions about this policy, or if a host is unreachable, write to <a href={`mailto:${contactEmail}`}>{contactEmail}</a> with the order number from your ticket email.</p>
    </>
  );
}
