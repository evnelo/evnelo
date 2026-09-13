import * as React from "react";
import { ButtonLink, EmailLayout, Para, Title, emailI18n, strong, type EmailBrand, type EmailI18n } from "./layout";

/** `locale`/`t`: the language the person joined in (waitlist_entries.locale); the sender in app/api/waitlist/route.ts passes them. */
export type WaitlistJoinedProps = EmailI18n & { brand: EmailBrand; eventName: string; eventUrl: string; position: number };
export const waitlistJoinedSubject = (p: WaitlistJoinedProps) => emailI18n(p).t("waitlistJoined.subject", { eventName: p.eventName });

export default function WaitlistJoined(props: WaitlistJoinedProps) {
  const { brand, eventName, eventUrl, position } = props;
  const { locale, t } = emailI18n(props);
  return (
    <EmailLayout brand={brand} locale={locale} t={t} preview={t("waitlistJoined.preview", { position })}>
      <Title>{t("waitlistJoined.title")}</Title>
      <Para>{t.rich("waitlistJoined.full", { eventName, strong })} {t.rich("waitlistJoined.position", { position, strong })} {t("waitlistJoined.offer")}</Para>
      <ButtonLink href={eventUrl} accent={brand.accent}>{t("waitlistJoined.cta")}</ButtonLink>
    </EmailLayout>
  );
}
