import * as React from "react";
import { createTranslator } from "next-intl";
import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from "@react-email/components";
import { DEFAULT_LOCALE, dirFor, type Locale } from "@/i18n/locales";
import en from "@/messages/en/emails.json";

/** Shared brand for every transactional email. Colours mirror globals.css; type falls back to email-safe faces. */
export type EmailBrand = { orgName: string; orgLogoUrl?: string | null; accent?: string | null; appUrl: string };

/**
 * Every template takes the recipient's `locale` and a translator `t` bound to the "emails"
 * namespace (`emailTranslator(locale)` in lib/email.ts builds both). Both are optional so a
 * caller that has not been localised yet still compiles and gets English.
 */
export type EmailMessages = { emails: typeof en };
export type EmailTranslator = ReturnType<typeof createTranslator<EmailMessages, "emails">>;
export type EmailI18n = { locale?: Locale; t?: EmailTranslator };

const english: EmailTranslator = createTranslator({ locale: DEFAULT_LOCALE, messages: { emails: en } as EmailMessages, namespace: "emails" });

/** Resolve the i18n props of a template: what was passed, else English. */
export function emailI18n(p: EmailI18n): { locale: Locale; t: EmailTranslator } {
  return { locale: p.locale ?? DEFAULT_LOCALE, t: p.t ?? english };
}

export const colors = {
  background: "#F7F7F2", card: "#FFFFFF", border: "#E9EAE4", ink: "#14151A", muted: "#6C6E73", accent: "#FF5A3C",
  paper: "#14151A", paperInk: "#F7F7F2", perforation: "#3A3D44", lime: "#C9F269",
};
export const fonts = {
  sans: "'Instrument Sans', Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  display: "'Instrument Sans', Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

/** Rich-text tag renderers shared by the templates: `<strong>` and `<link>` markers in the messages. */
export const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
export const linkTo = (href: string, style: React.CSSProperties = { color: colors.accent }) => (chunks: React.ReactNode) => <Link href={href} style={style}>{chunks}</Link>;

export function EmailLayout({ brand, preview, children, footer, locale, t }: EmailI18n & { brand: EmailBrand; preview: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const i18n = emailI18n({ locale, t });
  return (
    <Html lang={i18n.locale} dir={dirFor(i18n.locale)}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, backgroundColor: colors.background, fontFamily: fonts.sans, color: colors.ink, textAlign: "start" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
          <Section style={{ marginBottom: 16 }}>
            {brand.orgLogoUrl ? (
              <Img src={brand.orgLogoUrl} alt={brand.orgName} height={28} style={{ height: 28, width: "auto", objectFit: "contain" }} />
            ) : (
              <Text style={{ margin: 0, fontFamily: fonts.display, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: colors.ink }}>{brand.orgName}</Text>
            )}
          </Section>
          <Section style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, padding: "32px 32px 28px" }}>
            {children}
          </Section>
          <Section style={{ padding: "20px 4px 0" }}>
            {footer}
            <Text style={{ margin: "8px 0 0", fontSize: 12, lineHeight: "18px", color: colors.muted }}>
              {i18n.t.rich("layout.footer", { orgName: brand.orgName, link: linkTo(brand.appUrl, { color: colors.muted }) })}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={{ margin: "0 0 14px", fontFamily: fonts.display, fontSize: 30, lineHeight: "36px", letterSpacing: "-0.03em", fontWeight: 700, color: colors.ink }}>{children}</Text>;
}
export function Para({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: React.CSSProperties }) {
  return <Text style={{ margin: "0 0 12px", fontSize: 15, lineHeight: "23px", color: muted ? colors.muted : colors.ink, ...style }}>{children}</Text>;
}
export function ButtonLink({ href, children, accent }: { href: string; children: React.ReactNode; accent?: string | null }) {
  return (
    <Link href={href} style={{ display: "inline-block", backgroundColor: accent || colors.accent, color: "#ffffff", fontSize: 14, fontWeight: 500, textDecoration: "none", padding: "12px 20px", borderRadius: 10 }}>
      {children}
    </Link>
  );
}
export function Divider() {
  return <Hr style={{ border: 0, borderTop: `1px solid ${colors.border}`, margin: "20px 0" }} />;
}

/** What every ticket-bearing email shows about the event. `when` and `where` arrive pre-formatted in the recipient's locale. */
export type EmailEvent = { name: string; url: string; when: string; where: string; onlineUrl?: string | null; calendarUrl: string };

const eyebrow: React.CSSProperties = { margin: 0, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: colors.muted };

export function EventBlock({ event, t }: { event: EmailEvent; t: EmailTranslator }) {
  return (
    <Section style={{ margin: "4px 0 20px", padding: "14px 16px", borderLeft: `3px solid ${colors.accent}`, backgroundColor: colors.background, borderRadius: "0 10px 10px 0" }}>
      <Text style={eyebrow}>{t("layout.when")}</Text>
      <Para style={{ margin: "2px 0 10px" }}><strong>{event.when}</strong></Para>
      <Text style={eyebrow}>{t("layout.where")}</Text>
      <Para style={{ margin: "2px 0 0" }}>{event.where}</Para>
      {event.onlineUrl && (
        <Para style={{ margin: "10px 0 0" }}><Link href={event.onlineUrl} style={{ color: colors.accent, fontWeight: 500 }}>{t("layout.joinOnline")}</Link></Para>
      )}
    </Section>
  );
}

/** Secondary actions (calendar, wallets) as small outlined pills. */
export function PillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ display: "inline-block", border: `1px solid ${colors.border}`, color: colors.ink, fontSize: 13, fontWeight: 500, textDecoration: "none", padding: "8px 14px", borderRadius: 999, marginRight: 8, marginBottom: 8, backgroundColor: colors.card }}>
      {children}
    </Link>
  );
}

/** The ticket as an object: paper stub with name, type and a scannable QR. */
export type EmailTicket = { attendeeName: string; ticketTypeName: string; url: string; qrUrl: string; guestOf?: string | null };

export function TicketCard({ ticket, accent, t }: { ticket: EmailTicket; accent?: string | null; t: EmailTranslator }) {
  return (
    <Section style={{ backgroundColor: colors.paper, color: colors.paperInk, borderRadius: 12, marginBottom: 12 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: "top", padding: "18px 16px 18px 20px" }}>
              <Text style={{ margin: 0, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: colors.accent }}>{t("layout.admitOne")}</Text>
              <Text style={{ margin: "4px 0 0", fontFamily: fonts.display, fontSize: 22, lineHeight: "26px", fontWeight: 700, letterSpacing: "-0.02em", color: colors.paperInk }}>{ticket.attendeeName}</Text>
              <Text style={{ margin: "2px 0 0", fontSize: 13, color: colors.paperInk, opacity: 0.75 }}>
                {ticket.guestOf ? t("layout.ticketTypeGuestOf", { ticketType: ticket.ticketTypeName, host: ticket.guestOf }) : ticket.ticketTypeName}
              </Text>
              <Text style={{ margin: "16px 0 0" }}>
                <ButtonLink href={ticket.url} accent={accent}>{t("layout.openTicket")}</ButtonLink>
              </Text>
            </td>
            <td width={144} style={{ verticalAlign: "middle", textAlign: "center", padding: "16px 16px 16px 12px", borderLeft: `2px dashed ${colors.perforation}` }}>
              <Img src={ticket.qrUrl} alt={t("layout.qrAlt")} width={112} height={112} style={{ width: 112, height: 112, backgroundColor: "#ffffff", borderRadius: 8, padding: 6, display: "inline-block" }} />
              <Text style={{ margin: "6px 0 0", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: colors.paperInk, opacity: 0.7 }}>{t("layout.scanAtDoor")}</Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

export type EmailReceipt = {
  orderId: string; paidOn: string; paidWith?: string | null;
  lines: { label: string; amount: string }[];
  totals: { label: string; amount: string; strong?: boolean }[];
  url: string; stripeReceiptUrl?: string | null;
};

/** The receipt under the tickets: what was bought, what it came to, what paid for it. */
export function ReceiptBlock({ receipt, t }: { receipt: EmailReceipt; t: EmailTranslator }) {
  const cell = (strong?: boolean): React.CSSProperties => ({ padding: "5px 0", fontSize: 14, lineHeight: "20px", color: strong ? colors.ink : colors.muted, fontWeight: strong ? 600 : 400 });
  return (
    <Section style={{ margin: "20px 0 0", padding: "16px 18px", border: `1px solid ${colors.border}`, borderRadius: 12, backgroundColor: colors.card }}>
      <Text style={{ margin: 0, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: colors.muted }}>{t("layout.receipt")}</Text>
      <Text style={{ margin: "4px 0 10px", fontSize: 13, lineHeight: "19px", color: colors.muted }}>
        {t("layout.receiptMeta", { orderId: receipt.orderId, paidOn: receipt.paidOn })}
        {receipt.paidWith ? ` · ${t("layout.paidWith", { method: receipt.paidWith })}` : null}
      </Text>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
        <tbody>
          {receipt.lines.map((line, i) => (
            <tr key={`l${i}`} style={{ borderTop: `1px solid ${colors.border}` }}><td style={cell(true)}>{line.label}</td><td align="right" style={cell(true)}>{line.amount}</td></tr>
          ))}
          {receipt.totals.map((row, i) => (
            <tr key={`t${i}`} style={row.strong ? { borderTop: `1px solid ${colors.border}` } : undefined}><td style={cell(row.strong)}>{row.label}</td><td align="right" style={cell(row.strong)}>{row.amount}</td></tr>
          ))}
        </tbody>
      </table>
      <Text style={{ margin: "12px 0 0", fontSize: 13 }}>
        <Link href={receipt.url} style={{ color: colors.accent }}>{t("layout.viewReceipt")}</Link>
        {receipt.stripeReceiptUrl ? <> · <Link href={receipt.stripeReceiptUrl} style={{ color: colors.accent }}>{t("layout.stripeReceipt")}</Link></> : null}
      </Text>
    </Section>
  );
}
