import { LEGAL } from "@/lib/legal";

/** Privacy Policy, English. A draft for legal review; the facts come from lib/legal.ts. */
export function PrivacyPolicy() {
  const { product, entity, contactEmail } = LEGAL;
  return (
    <>
      <p>This policy explains what {product}, operated by {entity}, collects, why, and what you can do about it. We keep it short on purpose: we collect little, and nothing we do not need to run the service.</p>

      <h2>1. Hosts and attendees</h2>
      <p>When a host uses {product} to run an event, the host decides what to ask attendees and what to do with the answers. For that data the host is the controller and {entity} is the processor: we store and process it on the host&rsquo;s instructions. For hosts&rsquo; own account data, and for the way the service itself works, {entity} is the controller.</p>

      <h2>2. What we collect</h2>
      <ul>
        <li><strong>Host accounts:</strong> your email address, your name if you give it or sign in with Google, the organization you create and the events you publish.</li>
        <li><strong>Registrations:</strong> the name, email address, optional phone number and answers an attendee gives when registering, the tickets issued and their check-in status. Files uploaded to a registration form are stored privately and shown only to the host&rsquo;s team.</li>
        <li><strong>Payments:</strong> Stripe processes card payments and holds card details; we never see a full card number. We keep the order amount, currency, the payment method type, the card brand and last four digits, and Stripe&rsquo;s identifiers, so we can show receipts and handle refunds.</li>
        <li><strong>Messages:</strong> the emails and text messages we send on the host&rsquo;s behalf (tickets, reminders, updates) and their delivery status, including whether an email was opened or a link in it clicked when the email provider reports that.</li>
        <li><strong>Event page traffic:</strong> for each event page we count visits without cookies. The visitor is represented by a hash of the IP address and browser combined with a secret that changes every day; the address itself is never stored and the hash cannot be turned back into it. We keep the referring site, campaign parameters, the country when our network provider reports it, and whether the visit led to a registration.</li>
        <li><strong>Product analytics and errors:</strong> we use PostHog to understand how the service is used and to catch errors. On public pages this runs without cookies and without creating a profile of you. In the host dashboard, usage is tied to your account id so we can support you; it is never tied to attendees.</li>
        <li><strong>Technical logs:</strong> our servers keep short-lived logs of requests and errors to keep the service secure and working.</li>
      </ul>

      <h2>3. Cookies</h2>
      <p>Public pages, event pages, checkout and tickets set no tracking cookies. Signed-in hosts get a session cookie, a cookie remembering the current organization, and, if they choose a language, a language cookie. Stripe sets its own cookies during checkout for fraud prevention.</p>

      <h2>4. Why we process data</h2>
      <p>To run the service you asked for (registrations, tickets, payments, messages), to keep it secure and to improve it, to comply with the law, and, for hosts, to contact you about your account. We do not sell personal data and we do not use attendee data for advertising.</p>

      <h2>5. Who else sees it</h2>
      <p>We rely on a small number of providers, each bound by a contract to protect the data: Stripe (payments), Resend (email), Vonage (text messages), Amazon Web Services (file storage), PostHog (analytics and error reporting), Google (sign-in with Google, and machine translation of the interface, which never involves personal data), and Cloudflare (network and security). Hosts see the data of their own attendees. We disclose data when the law requires it.</p>

      <h2>6. Where and how long</h2>
      <p>Data is stored on servers in the United States and the European Union. Hosts control how long attendee data stays: a host can erase an attendee, which replaces their details with placeholders while keeping the counts and financial records intact, and deleting an organization removes its events and everyone in them. Event traffic records are deleted after 400 days. Payment records are kept as long as accounting rules require.</p>

      <h2>7. Your rights</h2>
      <p>You can access, correct or delete your data and object to or restrict its processing, and, where it applies, take your data with you. Attendees should contact the host of their event first, since the host controls that data; hosts can export everything they hold from the dashboard. For anything about your host account, or if a host does not respond, write to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>. Attendees can also unsubscribe from reminders using the link in every email, and stop text messages by replying STOP.</p>

      <h2>8. Children</h2>
      <p>{product} is not directed at children under 16, and hosts may not use it to collect their data without a parent&rsquo;s consent where the law requires one.</p>

      <h2>9. Changes and contact</h2>
      <p>We may update this policy; the date at the top says when. Material changes are announced to hosts before they take effect. Questions and requests go to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>
    </>
  );
}
