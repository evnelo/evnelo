import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { emailTranslator } from "@/lib/email";
import { smsTemplates } from "@/lib/sms";
import { reminderPhrase } from "@/lib/notifications/deliver";
import RegistrationConfirmation, { registrationConfirmationSubject } from "./registration-confirmation";
import ApprovalPending, { approvalPendingSubject } from "./approval-pending";
import RefundIssued, { refundIssuedSubject } from "./refund-issued";
import EventReminder, { eventReminderSubject } from "./event-reminder";
import RegistrationRejected, { registrationRejectedSubject } from "./registration-rejected";
import EventUpdated, { eventUpdatedSubject } from "./event-updated";
import EventCancelled, { eventCancelledSubject } from "./event-cancelled";
import EventInvite, { eventInviteSubject } from "./event-invite";
import OrgInvite, { orgInviteSubject } from "./org-invite";
import MagicLink, { magicLinkSubject } from "./magic-link";
import WaitlistJoined, { waitlistJoinedSubject } from "./waitlist-joined";
import WaitlistOffer, { waitlistOfferSubject } from "./waitlist-offer";
import AbuseReport, { abuseReportSubject } from "./abuse-report";

const brand = { orgName: "Demo Collective", orgLogoUrl: null, accent: null, appUrl: "http://localhost:3000" };
const event = { name: "Design Systems Meetup", url: "http://localhost:3000/demo/dsm", when: "Tuesday, September 22, 6:00 PM to 9:00 PM", where: "Casa Cultural, São Paulo", onlineUrl: null, calendarUrl: "http://localhost:3000/api/calendar/demo/dsm.ics" };
const tickets = [
  { attendeeName: "Ana Souza", ticketTypeName: "General admission", url: "http://localhost:3000/t/a", qrUrl: "http://localhost:3000/t/a/qr", guestOf: null },
  { attendeeName: "Rafael Lima", ticketTypeName: "General admission", url: "http://localhost:3000/t/b", qrUrl: "http://localhost:3000/t/b/qr", guestOf: "Ana Souza" },
];

const text = (el: React.ReactElement) => render(el, { plainText: true });

describe("email templates (English copy, extracted to messages/en/emails.json)", () => {
  it("renders every template with the English wording and translated subjects", async () => {
    const i18n = await emailTranslator("en");
    const cases: [React.ReactElement, string, string[]][] = [
      [<RegistrationConfirmation {...i18n} brand={brand} event={event} tickets={tickets} wallet={{ apple: "#", google: "#" }} />, registrationConfirmationSubject({ ...i18n, brand, event, tickets }),
        ["Your 2 tickets for Design Systems Meetup", "Here are your 2 tickets for Design Systems Meetup", "Show the QR code at the door, on your phone or printed.", "General admission, guest of Ana Souza", "Admit one", "Sent by Demo Collective through Evnelo"]],
      [<ApprovalPending {...i18n} brand={brand} event={event} attendeeName="Ana" partySize={2} />, approvalPendingSubject({ ...i18n, brand, event, attendeeName: "Ana", partySize: 2 }),
        ["Request received for Design Systems Meetup", "Hi Ana, Demo Collective reviews every registration for Design Systems Meetup", "Your request covers 2 people.", "You'll get your tickets by email as soon as it's approved."]],
      [<RefundIssued {...i18n} brand={brand} event={event} attendeeName="Ana" amount="$86.40" ticketCount={2} />, refundIssuedSubject({ ...i18n, brand, event, attendeeName: "Ana", amount: "$86.40", ticketCount: 2 }),
        ["Refund of $86.40 for Design Systems Meetup", "refunded $86.40 for your order", "All 2 tickets on the order are cancelled and will no longer scan."]],
      [<EventReminder {...i18n} brand={brand} event={event} when={reminderPhrase(i18n.t, 24)} tickets={[tickets[0]!]} unsubscribeUrl="http://localhost:3000/u" />, eventReminderSubject({ ...i18n, brand, event, when: reminderPhrase(i18n.t, 24), tickets, unsubscribeUrl: "#" }),
        ["Design Systems Meetup is tomorrow", "Your ticket, ready to scan:", "Don't want reminders for this event?", "Stop reminders", "Confirmations and changes still get through."]],
      [<RegistrationRejected {...i18n} brand={brand} event={event} attendeeName="Ana" paid={false} />, registrationRejectedSubject({ ...i18n, brand, event, attendeeName: "Ana", paid: false }),
        ["Update on your request for Design Systems Meetup", "We couldn't fit you in", "No payment was taken."]],
      [<EventUpdated {...i18n} brand={brand} event={event} attendeeName="Ana" changes={{ schedule: true, venue: false }} />, eventUpdatedSubject({ ...i18n, brand, event, attendeeName: "Ana", changes: { schedule: true, venue: false } }),
        ["New time for Design Systems Meetup", "updated the time for Design Systems Meetup", "Here are the new details. Your ticket stays valid."]],
      [<EventCancelled {...i18n} brand={brand} event={event} attendeeName="Ana" paid />, eventCancelledSubject({ ...i18n, brand, event, attendeeName: "Ana", paid: true }),
        ["Design Systems Meetup has been cancelled", "which was scheduled for Tuesday, September 22, 6:00 PM to 9:00 PM. Your ticket is no longer valid.", "Your payment will be refunded to the card you used"]],
      [<EventInvite {...i18n} brand={brand} event={event} url="#" expires="October 1" />, eventInviteSubject({ ...i18n, brand, event, url: "#" }),
        ["You're invited: Design Systems Meetup", "This link is personal to you and expires October 1. Register with this email address."]],
      [<OrgInvite {...i18n} brand={brand} url="#" orgName="Demo Collective" role="Admin" invitedBy="Mauricio" />, orgInviteSubject({ ...i18n, brand, url: "#", orgName: "Demo Collective", role: "Admin" }),
        ["You're invited to Demo Collective on Evnelo", "Mauricio invited you to help run events for Demo Collective as Admin.", "The link is valid for 14 days"]],
      [<MagicLink {...i18n} brand={brand} url="#" host="localhost:3000" />, magicLinkSubject({ ...i18n, brand, url: "#", host: "localhost:3000" }),
        ["Sign in to localhost:3000", "Click the button to sign in to localhost:3000. The link works once and expires in 15 minutes."]],
      [<WaitlistJoined {...i18n} brand={brand} eventName="Design Systems Meetup" eventUrl="#" position={3} />, waitlistJoinedSubject({ ...i18n, brand, eventName: "Design Systems Meetup", eventUrl: "#", position: 3 }),
        ["You're on the waitlist for Design Systems Meetup", "You are number 3 in line.", "the link stays valid for 24 hours."]],
      [<WaitlistOffer {...i18n} brand={brand} event={event} url="#" ticketTypeName="General admission" deadline="September 20, 6:00 PM BRT" />, waitlistOfferSubject({ ...i18n, brand, event, url: "#", ticketTypeName: "General admission", deadline: "x" }),
        ["A spot opened up: Design Systems Meetup", "Good news: a General admission spot for Design Systems Meetup is reserved for you.", "Claim it before September 20, 6:00 PM BRT, after that it goes to the next person in line."]],
      [<AbuseReport {...i18n} brand={brand} eventName="Design Systems Meetup" eventUrl="#" orgName="Demo Collective" reason="Spam" details={null} reporterEmail={null} />, abuseReportSubject({ ...i18n, brand, eventName: "Design Systems Meetup", eventUrl: "#", orgName: "Demo Collective", reason: "Spam", details: null, reporterEmail: null }),
        ["[Report] Spam: Design Systems Meetup", "Design Systems Meetup by Demo Collective was reported for Spam.", "The reporter did not leave an email."]],
    ];
    for (const [el, subject, expected] of cases) {
      const [plain, html] = await Promise.all([text(el), render(el)]);
      expect(subject).toBe(expected[0]);
      for (const s of expected.slice(1)) expect(plain).toContain(s);
      expect(html).toContain('lang="en"');
      expect(html).toContain('dir="ltr"');
    }
  });

  it("renders in the recipient's language, right to left where the script needs it", async () => {
    const i18n = await emailTranslator("ar");
    const html = await render(<MagicLink {...i18n} brand={brand} url="#" host="evnelo.com" />);
    expect(html).toContain('lang="ar"');
    expect(html).toContain('dir="rtl"');
    const subject = magicLinkSubject({ ...i18n, brand, url: "#", host: "evnelo.com" });
    expect(subject).toContain("evnelo.com"); // the host is data, not copy
    expect(subject).not.toBe("Sign in to evnelo.com");
    expect(subject).toMatch(/\p{Script=Arabic}/u);
  });

  it("defaults to English when a caller passes no locale or translator", async () => {
    const plain = await text(<MagicLink brand={brand} url="#" host="evnelo.com" />);
    expect(plain).toContain("Nobody can sign in without the link.");
    expect(magicLinkSubject({ brand, url: "#", host: "evnelo.com" })).toBe("Sign in to evnelo.com");
  });

  it("keeps the SMS wording and reminder phrasing", async () => {
    const { t } = await emailTranslator("en");
    expect(smsTemplates.confirmation(t, { event: "DSM", ticketUrl: "http://x/t/a" })).toBe("You're in for DSM. Your ticket: http://x/t/a");
    expect(smsTemplates.reminder(t, { event: "DSM", when: reminderPhrase(t, 1), ticketUrl: "http://x/t/a" })).toBe("DSM is in 1 hour. Ticket: http://x/t/a");
    expect(smsTemplates.updated(t, { event: "DSM", url: "http://x/e" })).toBe("DSM has changed its time or venue. Details: http://x/e");
    expect(smsTemplates.cancelled(t, { event: "DSM" })).toBe("DSM has been cancelled. Any payment will be refunded.");
    expect(reminderPhrase(t, 48)).toBe("in 2 days");
    expect(reminderPhrase(t, 3)).toBe("in 3 hours");
  });
});
