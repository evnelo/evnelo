import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LEGAL_DOCS, type LegalDoc } from "@/lib/legal";
import { LegalPage } from "@/components/legal/legal-doc";
import { TermsOfService } from "@/components/legal/terms";
import { PrivacyPolicy } from "@/components/legal/privacy";
import { RefundPolicy } from "@/components/legal/refunds";

const isDoc = (value: string): value is LegalDoc => (LEGAL_DOCS as readonly string[]).includes(value);
const DOCS: Record<LegalDoc, () => React.ReactElement> = { terms: TermsOfService, privacy: PrivacyPolicy, refunds: RefundPolicy };

export function generateStaticParams() {
  return LEGAL_DOCS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  if (!isDoc(doc)) return {};
  const t = await getTranslations("public.legal");
  return { title: t(`docs.${doc}`) };
}

/** /legal/terms, /legal/privacy, /legal/refunds. English text, translated labels; the documents live in components/legal. */
export default async function LegalDocPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!isDoc(doc)) notFound();
  const t = await getTranslations("public.legal");
  const Doc = DOCS[doc];
  return (
    <LegalPage doc={doc} title={t(`docs.${doc}`)}>
      <Doc />
    </LegalPage>
  );
}
