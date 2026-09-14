import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { LEGAL, LEGAL_DOCS } from "@/lib/legal";

export async function generateMetadata() {
  const t = await getTranslations("public.legal");
  return { title: t("title") };
}

/** /legal: the three documents, one line each. */
export default async function LegalIndexPage() {
  const t = await getTranslations("public.legal");
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="display mt-2 text-4xl sm:text-5xl">{t("title")}</h1>
      <p className="mt-4 text-[15px] leading-7 text-muted-foreground">{t("intro", { entity: LEGAL.entity })}</p>
      <ul className="mt-8 divide-y divide-border/70 rounded-2xl border border-border/80 bg-card shadow-card">
        {LEGAL_DOCS.map((doc, i) => (
          <li key={doc} className="animate-rise" style={{ ["--stagger" as string]: i }}>
            <Link href={`/legal/${doc}`} className="press flex items-center justify-between gap-4 p-5 hover:bg-muted/40">
              <span>
                <span className="block font-medium">{t(`docs.${doc}`)}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{t(`summary.${doc}`)}</span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
