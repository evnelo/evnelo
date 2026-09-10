import * as React from "react";
import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import RegistrationConfirmation from "@/emails/registration-confirmation";
import ApprovalPending from "@/emails/approval-pending";
import RefundIssued from "@/emails/refund-issued";
import EventReminder from "@/emails/event-reminder";
import RegistrationRejected from "@/emails/registration-rejected";
import EventUpdated from "@/emails/event-updated";
import EventCancelled from "@/emails/event-cancelled";
import MagicLink from "@/emails/magic-link";
import OrgInvite from "@/emails/org-invite";

export const runtime = "nodejs";

/**
 * Development only: GET /dev/emails/{registration_confirmation|approval_pending|refund_issued|reminder}
 * renders each template with sample data. Append ?text=1 for the plain-text part.
 */
const brand = { orgName: "Demo Collective", orgLogoUrl: null, accent: null, appUrl: "http://localhost:3000" };
const event = {
  name: "Design Systems Meetup, September edition", url: "http://localhost:3000/demo-collective/design-systems-meetup",
  when: "Tuesday, September 22, 6:00 PM to 9:00 PM", where: "Casa Cultural, Rua Augusta 1500, São Paulo", onlineUrl: null,
  calendarUrl: "http://localhost:3000/api/calendar/design-systems-meetup.ics",
};
const qr = "https://api.qrserver.com/v1/create-qr-code/?size=224x224&data=sample"; // preview only; real emails use /t/{token}/qr?format=png
const tickets = [
  { attendeeName: "Ana Souza", ticketTypeName: "General admission", url: "http://localhost:3000/t/sample", qrUrl: qr, guestOf: null },
  { attendeeName: "Rafael Lima", ticketTypeName: "General admission", url: "http://localhost:3000/t/sample2", qrUrl: qr, guestOf: "Ana Souza" },
];
const samples: Record<string, () => React.ReactElement> = {
  registration_confirmation: () => React.createElement(RegistrationConfirmation, { brand, event, tickets, wallet: { apple: "#", google: "#" } }),
  approval_pending: () => React.createElement(ApprovalPending, { brand, event, attendeeName: "Ana", partySize: 2 }),
  refund_issued: () => React.createElement(RefundIssued, { brand, event, attendeeName: "Ana", amount: "$86.40", ticketCount: 2 }),
  reminder: () => React.createElement(EventReminder, { brand, event: { ...event, onlineUrl: "https://meet.example.com/abc" }, when: "tomorrow", tickets, unsubscribeUrl: "#" }),
  registration_rejected: () => React.createElement(RegistrationRejected, { brand, event, attendeeName: "Ana", paid: false }),
  event_updated: () => React.createElement(EventUpdated, { brand, event, attendeeName: "Ana", changes: { schedule: true, venue: false } }),
  event_cancelled: () => React.createElement(EventCancelled, { brand, event, attendeeName: "Ana", paid: true }),
  magic_link: () => React.createElement(MagicLink, { brand: { ...brand, orgName: "OpenTicket" }, url: "#", host: "localhost:3000" }),
  org_invite: () => React.createElement(OrgInvite, { brand: { ...brand, orgName: "OpenTicket" }, url: "#", orgName: "Demo Collective", role: "Admin", invitedBy: "Mauricio" }),
};

export async function GET(req: Request, { params }: { params: Promise<{ template: string }> }) {
  if (process.env.NODE_ENV === "production") return new NextResponse("not found", { status: 404 });
  const { template } = await params;
  const make = samples[template];
  if (!make) return new NextResponse(`unknown template. try: ${Object.keys(samples).join(", ")}`, { status: 404 });
  const plain = new URL(req.url).searchParams.has("text");
  const out = await render(make(), plain ? { plainText: true } : undefined);
  return new NextResponse(out, { headers: { "content-type": plain ? "text/plain; charset=utf-8" : "text/html; charset=utf-8" } });
}
