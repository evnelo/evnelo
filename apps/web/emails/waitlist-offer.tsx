import * as React from "react";
import { ButtonLink, EmailLayout, EventBlock, Para, Title, emailI18n, strong, type EmailBrand, type EmailEvent, type EmailI18n } from "./layout";

/**
 * `locale`/`t`: the language the person joined the waitlist in (waitlist_entries.locale); the
 * sender (promoteWaitlistAction in app/dashboard/actions.ts) passes them and formats `deadline`
 * and `event.when` in that locale.
 */
export type WaitlistOfferProps = EmailI18n & { brand: EmailBrand; event: EmailEvent; url: string; ticketTypeName: string; deadline: string };
export const waitlistOfferSubject = (p: WaitlistOfferProps) => emailI18n(p).t("waitlistOffer.subject", { eventName: p.event.name });

export default function WaitlistOffer(props: WaitlistOfferProps) {
  const { brand, event, url, ticketTypeName, deadline } = props;
  const { locale, t } = emailI18n(props);
  return (
    <EmailLayout brand={brand} locale={locale} t={t} preview={t("waitlistOffer.preview", { deadline })}>
      <Title>{t("waitlistOffer.title")}</Title>
      <Para>{t.rich("waitlistOffer.reserved", { ticketType: ticketTypeName, eventName: event.name, strong })} {t.rich("waitlistOffer.claimBefore", { deadline, strong })}</Para>
      <EventBlock event={{ ...event, onlineUrl: null }} t={t} />
      <ButtonLink href={url} accent={brand.accent}>{t("waitlistOffer.cta")}</ButtonLink>
      <Para muted style={{ margin: "20px 0 0", fontSize: 13 }}>{t("waitlistOffer.registerWith")} {t("waitlistOffer.personal")}</Para>
    </EmailLayout>
  );
}
