import * as React from "react";
import { ButtonLink, EmailLayout, Para, Title, emailI18n, type EmailBrand, type EmailI18n } from "./layout";

export type MagicLinkProps = EmailI18n & { brand: EmailBrand; url: string; host: string };
export const magicLinkSubject = (p: MagicLinkProps) => emailI18n(p).t("magicLink.subject", { host: p.host });

export default function MagicLink(props: MagicLinkProps) {
  const { brand, url, host } = props;
  const { locale, t } = emailI18n(props);
  return (
    <EmailLayout brand={brand} locale={locale} t={t} preview={t("magicLink.preview", { host })}>
      <Title>{t("magicLink.title")}</Title>
      <Para>{t("magicLink.intro", { host })} {t("magicLink.expiry")}</Para>
      <ButtonLink href={url}>{t("magicLink.cta", { host })}</ButtonLink>
      <Para muted style={{ margin: "20px 0 0", fontSize: 13 }}>{t("magicLink.ignore")} {t("magicLink.nobody")}</Para>
    </EmailLayout>
  );
}
