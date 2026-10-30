import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { FeeComparison } from "@/components/marketing/fee-calculator";
import { ComparisonTable, CtaBand, FeatureGrid, LandingHero, Section, SectionHead, SourceNote } from "@/components/marketing/landing";
import { COMPARE_PAGES, COMPARISONS, PRICING_SOURCES, isComparePage } from "@/lib/competitor-fees";

type Params = { params: Promise<{ competitor: string }> };

const ROWS = ["fee", "fixed", "free", "processing", "subscription", "openSource"] as const;
const STEPS = ["signup", "stripe", "event", "share"] as const;
const NAMES = { eventbrite: "Eventbrite", luma: "Luma" } as const;

export function generateStaticParams() {
  return COMPARE_PAGES.map((competitor) => ({ competitor }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { competitor } = await params;
  if (!isComparePage(competitor)) return {};
  const t = await getTranslations(`public.compare.${competitor}.meta`);
  return { title: t("title"), description: t("description"), alternates: { canonical: `/compare/${competitor}` } };
}

/** /compare/eventbrite and /compare/luma: the fee gap on the visitor's own numbers, then the facts behind it with their source. */
export default async function ComparePage({ params }: Params) {
  const { competitor } = await params;
  if (!isComparePage(competitor)) notFound();
  const [t, calc, locale] = await Promise.all([getTranslations("public.compare"), getTranslations("public.calculator"), getLocale()]);
  const source = PRICING_SOURCES[competitor];
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${source.checked}T12:00:00Z`));

  return (
    <div className="overflow-x-clip">
      <LandingHero
        eyebrow={t(`${competitor}.eyebrow`)}
        title={t(`${competitor}.title`)}
        body={t(`${competitor}.body`)}
        actions={<>
          <Button asChild size="lg"><Link href="/login">{t("start")}</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/pricing">{t("seePricing")}</Link></Button>
        </>}
        aside={<FeeComparison platforms={COMPARISONS[competitor]} currency={source.currency} defaultPrice={25} />}
      />

      <Section>
        <SectionHead title={t("table.title")} body={t("calculator.body")} />
        <div className="mt-8">
          <ComparisonTable
            caption={t("table.title")}
            featureLabel={t("table.feature")}
            columns={[calc("platforms.evnelo"), NAMES[competitor]]}
            rows={ROWS.map((row) => ({ label: t(`rowLabels.${row}`), values: [t(`evneloRows.${row}`), t(`${competitor}.rows.${row}`)] }))}
          />
        </div>
      </Section>

      <section className="border-y bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20"><FeatureGrid /></div>
      </section>

      <Section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <SectionHead title={t("switching.title")} body={t("switching.note")} />
        <ol className="grid gap-3">
          {STEPS.map((id, i) => (
            <li key={id} className="flex items-center gap-4 rounded-lg border bg-card p-5 shadow-card">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{i + 1}</span>
              <span className="font-medium">{t(`switching.steps.${id}`)}</span>
            </li>
          ))}
        </ol>
      </Section>

      <CtaBand title={t("cta.title")} body={t("cta.body")} action={t("start")} />
      <SourceNote>
        {t.rich("source", {
          competitor: NAMES[competitor],
          url: source.url.replace(/^https:\/\//, ""),
          date,
          link: (chunks) => <a href={source.url} rel="noopener noreferrer nofollow">{chunks}</a>,
        })}
      </SourceNote>
    </div>
  );
}
