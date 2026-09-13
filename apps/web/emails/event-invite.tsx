import * as React from "react";
import { ButtonLink, EmailLayout, EventBlock, Para, Title, emailI18n, strong, type EmailBrand, type EmailEvent, type EmailI18n } from "./layout";

/** `expires` arrives pre-formatted in the recipient's locale (the caller formats it). */
export type EventInviteProps = EmailI18n & { brand: EmailBrand; event: EmailEvent; url: string; expires?: string | null };
export const eventInviteSubject = (p: EventInviteProps) => emailI18n(p).t("eventInvite.subject", { eventName: p.event.name });

export default function EventInvite(props: EventInviteProps) {
  const { brand, event, url, expires } = props;
  const { locale, t } = emailI18n(props);
  return (
    <EmailLayout brand={brand} locale={locale} t={t} preview={t("eventInvite.preview", { orgName: brand.orgName, eventName: event.name })}>
      <Title>{t("eventInvite.title")}</Title>
      <Para>{t.rich("eventInvite.intro", { orgName: brand.orgName, strong })}</Para>
      <EventBlock event={{ ...event, onlineUrl: null }} t={t} />
      <ButtonLink href={url} accent={brand.accent}>{t("eventInvite.cta")}</ButtonLink>
      <Para muted style={{ margin: "20px 0 0", fontSize: 13 }}>{expires ? t("eventInvite.personalExpires", { expires }) : t("eventInvite.personal")} {t("eventInvite.registerWith")}</Para>
    </EmailLayout>
  );
}
