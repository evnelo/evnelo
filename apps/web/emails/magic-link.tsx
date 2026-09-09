import * as React from "react";
import { ButtonLink, EmailLayout, Para, Title, type EmailBrand } from "./layout";

export type MagicLinkProps = { brand: EmailBrand; url: string; host: string };
export const magicLinkSubject = (p: MagicLinkProps) => `Sign in to ${p.host}`;

export default function MagicLink({ brand, url, host }: MagicLinkProps) {
  return (
    <EmailLayout brand={brand} preview={`Your sign-in link for ${host}`}>
      <Title>Sign in</Title>
      <Para>Click the button to sign in to {host}. The link works once and expires in 15 minutes.</Para>
      <ButtonLink href={url}>Sign in to {host}</ButtonLink>
      <Para muted style={{ margin: "20px 0 0", fontSize: 13 }}>If you didn't ask for this, you can ignore this email. Nobody can sign in without the link.</Para>
    </EmailLayout>
  );
}
