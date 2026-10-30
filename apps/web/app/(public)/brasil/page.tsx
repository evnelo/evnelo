import Link from "next/link";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { BadgeCheck, Code2, Landmark, QrCode, ScanLine, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeeComparison } from "@/components/marketing/fee-calculator";
import { ComparisonTable, CtaBand, Faq, LandingHero, Section, SectionHead, SourceNote } from "@/components/marketing/landing";
import { COMPARISONS, PRICING_SOURCES } from "@/lib/competitor-fees";
import { loadMessages } from "@/i18n/messages";

/**
 * The landing page for Brazilian hosts, always in Portuguese: it exists for Portuguese searches and ads, and
 * crawlers send no Accept-Language, so following the visitor's locale would get it indexed in English.
 * The header and footer still follow the visitor.
 */
const LOCALE = "pt-BR";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: LOCALE, namespace: "public.brazil.meta" });
  return { title: t("title"), description: t("description"), alternates: { canonical: "/brasil" }, openGraph: { locale: "pt_BR" } };
}

const HIGHLIGHTS = [
  { id: "pix", icon: QrCode },
  { id: "payouts", icon: Landmark },
  { id: "free", icon: BadgeCheck },
  { id: "tiers", icon: Tags },
  { id: "checkin", icon: ScanLine },
  { id: "open", icon: Code2 },
] as const;
const ROWS = ["fee", "minimum", "free", "processing", "openSource"] as const;
const FAQ = ["passOn", "pix", "language", "free"] as const;

export default async function BrazilPage() {
  const [t, calc, messages] = await Promise.all([
    getTranslations({ locale: LOCALE, namespace: "public.brazil" }),
    getTranslations({ locale: LOCALE, namespace: "public.calculator" }),
    loadMessages(LOCALE),
  ]);
  const source = PRICING_SOURCES.sympla;
  const date = new Intl.DateTimeFormat(LOCALE, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${source.checked}T12:00:00Z`));
  const calculatorMessages = { public: { calculator: (messages.public as Record<string, unknown>).calculator } };

  return (
    <div lang={LOCALE} className="overflow-x-clip">
      <LandingHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        body={t("body")}
        actions={<>
          <Button asChild size="lg"><Link href="/login">{t("start")}</Link></Button>
          <Button asChild size="lg" variant="outline"><a href="#como-funciona">{t("seePricing")}</a></Button>
        </>}
        aside={
          <NextIntlClientProvider locale={LOCALE} messages={calculatorMessages}>
            <FeeComparison platforms={COMPARISONS.sympla} currency="BRL" defaultPrice={50} />
          </NextIntlClientProvider>
        }
      />

      <Section>
        <SectionHead title={t("highlights.title")} />
        <ul className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map(({ id, icon: Icon }) => (
            <li key={id} className="grid content-start gap-2">
              <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground"><Icon className="size-5" aria-hidden /></span>
              <p className="mt-2 text-lg font-semibold">{t(`highlights.items.${id}.title`)}</p>
              <p className="text-sm leading-6 text-muted-foreground">{t(`highlights.items.${id}.text`)}</p>
            </li>
          ))}
        </ul>
      </Section>

      <section id="como-funciona" className="scroll-mt-28 border-y bg-card md:scroll-mt-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:py-20">
          <SectionHead title={t("payments.title")} body={t("payments.body")} />
          <div className="min-w-0">
            <h3 className="mb-4 text-lg font-semibold">{t("table.title")}</h3>
            <ComparisonTable
              caption={t("table.title")}
              featureLabel={t("table.feature")}
              columns={[calc("platforms.evnelo"), calc("platforms.sympla")]}
              rows={ROWS.map((row) => ({ label: t(`rows.labels.${row}`), values: [t(`rows.evnelo.${row}`), t(`rows.sympla.${row}`)] }))}
            />
            <p className="mt-3 text-sm text-muted-foreground">{t("calculator.body")}</p>
          </div>
        </div>
      </section>

      <Section>
        <Faq title={t("faq.title")} items={FAQ.map((id) => ({ q: t(`faq.items.${id}.q`), a: t(`faq.items.${id}.a`) }))} />
      </Section>

      <CtaBand title={t("cta.title")} body={t("cta.body")} action={t("start")} />
      <SourceNote>
        {t.rich("source", {
          url: source.url.replace(/^https:\/\//, ""),
          date,
          link: (chunks) => <a href={source.url} rel="noopener noreferrer nofollow">{chunks}</a>,
        })}
      </SourceNote>
    </div>
  );
}
