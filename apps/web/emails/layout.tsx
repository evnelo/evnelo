import * as React from "react";
import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from "@react-email/components";

/** Shared brand for every transactional email. Colours mirror globals.css; type falls back to email-safe faces. */
export type EmailBrand = { orgName: string; orgLogoUrl?: string | null; accent?: string | null; appUrl: string };

export const colors = {
  background: "#f5f5f3", card: "#ffffff", border: "#dcdcd6", ink: "#000000", muted: "#6a6b66", accent: "#16603a",
  paper: "#f1e6b2", paperInk: "#2b2407",
};
export const fonts = {
  sans: "Geist, Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  display: "Fraunces, 'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
};

export function EmailLayout({ brand, preview, children, footer }: { brand: EmailBrand; preview: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, backgroundColor: colors.background, fontFamily: fonts.sans, color: colors.ink }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
          <Section style={{ marginBottom: 16 }}>
            {brand.orgLogoUrl ? (
              <Img src={brand.orgLogoUrl} alt={brand.orgName} height={28} style={{ height: 28, width: "auto", objectFit: "contain" }} />
            ) : (
              <Text style={{ margin: 0, fontFamily: fonts.display, fontSize: 20, color: colors.ink }}>{brand.orgName}</Text>
            )}
          </Section>
          <Section style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "28px 28px 24px" }}>
            {children}
          </Section>
          <Section style={{ padding: "20px 4px 0" }}>
            {footer}
            <Text style={{ margin: "8px 0 0", fontSize: 12, lineHeight: "18px", color: colors.muted }}>
              Sent by {brand.orgName} through <Link href={brand.appUrl} style={{ color: colors.muted }}>OpenTicket</Link>. This is a transactional message about an event you registered for.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={{ margin: "0 0 12px", fontFamily: fonts.display, fontSize: 28, lineHeight: "32px", letterSpacing: "-0.01em", color: colors.ink }}>{children}</Text>;
}
export function Para({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: React.CSSProperties }) {
  return <Text style={{ margin: "0 0 12px", fontSize: 15, lineHeight: "23px", color: muted ? colors.muted : colors.ink, ...style }}>{children}</Text>;
}
export function ButtonLink({ href, children, accent }: { href: string; children: React.ReactNode; accent?: string | null }) {
  return (
    <Link href={href} style={{ display: "inline-block", backgroundColor: accent || colors.accent, color: "#ffffff", fontSize: 14, fontWeight: 500, textDecoration: "none", padding: "11px 18px", borderRadius: 8 }}>
      {children}
    </Link>
  );
}
export function Divider() {
  return <Hr style={{ border: 0, borderTop: `1px solid ${colors.border}`, margin: "20px 0" }} />;
}

/** What every ticket-bearing email shows about the event. */
export type EmailEvent = { name: string; url: string; when: string; where: string; onlineUrl?: string | null; calendarUrl: string };

export function EventBlock({ event }: { event: EmailEvent }) {
  return (
    <Section style={{ margin: "4px 0 16px" }}>
      <Para style={{ margin: 0 }}><strong>{event.when}</strong></Para>
      <Para muted style={{ margin: 0 }}>{event.where}</Para>
      {event.onlineUrl && (
        <Para style={{ margin: "8px 0 0" }}>Join link: <Link href={event.onlineUrl} style={{ color: colors.accent }}>{event.onlineUrl}</Link></Para>
      )}
    </Section>
  );
}

/** The ticket as an object: paper stub with name, type and a scannable QR. */
export type EmailTicket = { attendeeName: string; ticketTypeName: string; url: string; qrUrl: string; guestOf?: string | null };

export function TicketCard({ ticket, accent }: { ticket: EmailTicket; accent?: string | null }) {
  return (
    <Section style={{ backgroundColor: colors.paper, color: colors.paperInk, borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: "top", paddingRight: 12 }}>
              <Text style={{ margin: 0, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.paperInk, opacity: 0.6 }}>Admit</Text>
              <Text style={{ margin: "2px 0 0", fontFamily: fonts.display, fontSize: 20, lineHeight: "24px", color: colors.paperInk }}>{ticket.attendeeName}</Text>
              <Text style={{ margin: "2px 0 0", fontSize: 13, color: colors.paperInk, opacity: 0.75 }}>
                {ticket.ticketTypeName}{ticket.guestOf ? `, guest of ${ticket.guestOf}` : ""}
              </Text>
              <Text style={{ margin: "14px 0 0" }}>
                <ButtonLink href={ticket.url} accent={accent}>View ticket</ButtonLink>
              </Text>
            </td>
            <td width={112} style={{ verticalAlign: "top", textAlign: "right" }}>
              <Img src={ticket.qrUrl} alt="Ticket QR code" width={112} height={112} style={{ width: 112, height: 112, backgroundColor: "#ffffff", borderRadius: 6, padding: 6 }} />
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}
