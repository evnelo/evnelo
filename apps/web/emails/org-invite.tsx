import * as React from "react";
import { ButtonLink, EmailLayout, Para, Title, emailI18n, strong, type EmailBrand, type EmailI18n } from "./layout";

/**
 * `locale`/`t` should be the inviter's request locale: the sender (inviteMemberAction in
 * app/dashboard/actions.ts) passes `await emailTranslator(await getLocale())`. `role` is a label
 * the caller should already have translated.
 */
export type OrgInviteProps = EmailI18n & { brand: EmailBrand; url: string; orgName: string; role: string; invitedBy?: string | null };
export const orgInviteSubject = (p: OrgInviteProps) => emailI18n(p).t("orgInvite.subject", { orgName: p.orgName });

export default function OrgInvite(props: OrgInviteProps) {
  const { brand, url, orgName, role, invitedBy } = props;
  const { locale, t } = emailI18n(props);
  return (
    <EmailLayout brand={brand} locale={locale} t={t} preview={t("orgInvite.preview", { orgName, role })}>
      <Title>{t("orgInvite.title", { orgName })}</Title>
      <Para>{invitedBy ? t.rich("orgInvite.invitedBy", { invitedBy, orgName, role, strong }) : t.rich("orgInvite.invited", { orgName, role, strong })}</Para>
      <ButtonLink href={url}>{t("orgInvite.cta")}</ButtonLink>
      <Para muted style={{ margin: "20px 0 0", fontSize: 13 }}>{t("orgInvite.validity")}</Para>
    </EmailLayout>
  );
}
