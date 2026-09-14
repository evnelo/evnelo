import { LEGAL } from "@/lib/legal";

/** Terms of Service, English. A draft for legal review; the facts come from lib/legal.ts. */
export function TermsOfService() {
  const { product, entity, contactEmail, governingLaw } = LEGAL;
  return (
    <>
      <p>These terms govern the use of {product}, an event registration and ticketing service operated by {entity} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account, publishing an event, registering for an event or buying a ticket, you agree to them.</p>

      <h2>1. Who does what</h2>
      <p>{product} is used by two kinds of people. <strong>Hosts</strong> create events, publish event pages, sell or give away tickets and check attendees in. <strong>Attendees</strong> register for events and buy tickets from hosts. {product} provides the platform; the host is the organizer of the event and the seller of its tickets.</p>
      <p>A ticket is a contract between the attendee and the host. {entity} is not a party to it, does not organize the events listed on {product} and is not responsible for what happens at them. Questions about an event, its schedule, venue, content, entry conditions or refunds go to the host.</p>

      <h2>2. Accounts</h2>
      <p>Hosts sign in with an email link or a Google account. You are responsible for what happens under your account and for keeping your email account secure. You must be at least 18 years old, or the age of majority where you live, to host events. Attendees do not need an account.</p>

      <h2>3. Hosting events</h2>
      <p>As a host you promise that your events are lawful where they take place, that you hold every permit or licence they need, that your event page is accurate and that you honour the tickets you issue. You are responsible for the personal data of your attendees and for using it only to run your event, as described in our <a href="/legal/privacy">Privacy Policy</a>.</p>
      <p>You may not use {product} for events or content that are illegal, fraudulent, deceptive, hateful, sexually explicit, or that infringe someone else&rsquo;s rights, and you may not use it to send unsolicited messages. We may unpublish an event, refuse a registration or close an account that breaks these rules, and we may report unlawful activity to the authorities.</p>

      <h2>4. Fees and payments</h2>
      <p>Free events are free to host. For paid tickets, {product} charges the host a platform fee of 0.99% of each ticket sold. The host chooses whether to absorb that fee or add it to the ticket price as a service fee; the attendee always sees the full price before paying.</p>
      <p>Card payments are processed by Stripe. A host connects their own Stripe account to {product} and Stripe pays ticket revenue out to that account under <a href="https://stripe.com/legal/connect-account" target="_blank" rel="noopener noreferrer">Stripe&rsquo;s terms</a>. {entity} never holds attendees&rsquo; money. Stripe&rsquo;s own processing fees are set and charged by Stripe. Taxes on tickets are the host&rsquo;s responsibility; {product} can add a tax rate to a ticket price but does not file or remit taxes for anyone.</p>

      <h2>5. Refunds, cancellations and disputes</h2>
      <p>Refunds are decided by the host, under the refund policy shown on the event page, and are issued through Stripe to the payment method used. Our <a href="/legal/refunds">Refund Policy</a> explains how that works and what happens to fees. If an attendee disputes a charge with their bank, the ticket is revoked while the dispute is open and the host is responsible for the outcome.</p>

      <h2>6. Your content</h2>
      <p>Hosts keep the rights to what they publish on {product} and give us a licence to display it, to send it in emails and messages to attendees, and to generate previews of it. Hosts must have the right to use every image and text they upload.</p>

      <h2>7. Our service</h2>
      <p>We work to keep {product} available and accurate, but it is provided &ldquo;as is&rdquo;. We may change or discontinue features with reasonable notice, and we may suspend the service for maintenance or to protect it. The software behind {product} is open source under the Apache 2.0 licence; these terms cover the hosted service at {LEGAL.website}, not the software when you run it yourself.</p>

      <h2>8. Liability</h2>
      <p>To the extent the law allows, {entity} is not liable for indirect, incidental or consequential damages, for lost profits or data, or for anything that happens at an event. For any claim relating to the service, our total liability is limited to the platform fees you paid us in the twelve months before the claim. Nothing in these terms limits liability that cannot be limited by law, including for fraud or for death or personal injury caused by negligence.</p>

      <h2>9. Ending the relationship</h2>
      <p>You can close your account at any time from the dashboard, which deletes your organization and its events as described in the Privacy Policy. We may suspend or close accounts that break these terms. Sections 4 to 8 survive the end of the relationship.</p>

      <h2>10. Changes and contact</h2>
      <p>We may update these terms. When the changes matter, we tell hosts by email or in the dashboard before they take effect; continuing to use {product} afterwards means you accept them. These terms are governed by {governingLaw}. Questions go to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>
    </>
  );
}
