import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LEGAL, LEGAL_DOCS, type LegalDoc } from "@/lib/legal";
import { cn } from "@/lib/utils";

/**
 * The frame every legal page shares: eyebrow, title, the date it was last changed, a note that
 * the text is in English, the document itself, and the other two documents underneath. The prose
 * styles live here so the documents stay plain HTML.
 */
export async function LegalPage({ doc, title, children }: { doc: LegalDoc; title: string; children: React.ReactNode }) {
  const t = await getTranslations("public.legal");
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="display mt-2 text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{t("updated", { date: LEGAL.updated })} · {t("englishOnly")}</p>
      <article
        className={cn(
          "mt-8 text-[15px] leading-7 text-foreground/90",
          "[&_h2]:display [&_h2]:mt-9 [&_h2]:text-xl [&_h2]:text-foreground [&_h2+p]:mt-2",
          "[&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:ps-5 [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold",
        )}
      >
        {children}
      </article>
      <nav aria-label={t("eyebrow")} className="hairline mt-12 flex flex-wrap gap-x-5 gap-y-2 pt-5 text-sm">
        {LEGAL_DOCS.filter((d) => d !== doc).map((d) => <Link key={d} href={`/legal/${d}`} className="underline decoration-dotted underline-offset-4 hover:decoration-solid">{t(`docs.${d}`)}</Link>)}
      </nav>
    </div>
  );
}
