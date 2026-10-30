import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GITHUB_REPO_URL } from "@/components/marketing/github-badge";
import { PricingCalculator } from "@/components/marketing/fee-calculator";
import { CtaBand, Faq, FeatureGrid, LandingHero, Section, SectionHead } from "@/components/marketing/landing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pricingPage.meta");
  return { title: t("title"), description: t("description"), alternates: { canonical: "/pricing" } };
}

const PLANS = [
  { id: "free", points: ["attendees", "questions", "messages", "sms"], href: "/login", accent: false },
  { id: "paid", points: ["everything", "methods", "sms", "passOn"], href: "/login", accent: true },
  { id: "selfHosted", points: ["license", "stack", "keys", "noFee"], href: GITHUB_REPO_URL, accent: false },
] as const;

const MONEY_STEPS = ["pay", "stripe", "evnelo", "payout"] as const;
const COMPARISONS = [
  { id: "eventbrite", href: "/compare/eventbrite" },
  { id: "luma", href: "/compare/luma" },
  { id: "brazil", href: "/brasil" },
] as const;
const FAQ = ["monthly", "stripe", "passOn", "free", "refunds", "currencies", "selfHost"] as const;

export default async function PricingPage() {
  const [t, home] = await Promise.all([getTranslations("public.pricingPage"), getTranslations("public.home.pricing.plans")]);
  return (
    <div className="overflow-x-clip">
      <LandingHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        body={t("body")}
        actions={<>
          <Button asChild size="lg"><Link href="/login">{t("start")}</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/compare/eventbrite">{t("compare")}</Link></Button>
        </>}
      />

      {/* Plans: the three ways to run Evnelo, the paid one in Pulse as on the home page */}
      <Section className="pt-0 lg:pt-0">
        <ul className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <li key={p.id} className={p.accent ? "animate-rise flex flex-col rounded-xl bg-pulse p-7 text-white" : "animate-rise flex flex-col rounded-xl border bg-card p-7 shadow-card"} style={{ "--stagger": i } as React.CSSProperties}>
              <p className={p.accent ? "text-sm font-medium text-white/85" : "text-sm font-medium text-muted-foreground"}>{home(`${p.id}.title`)}</p>
              <p className="display mt-3 text-6xl">{home(`${p.id}.price`)}</p>
              <p className={p.accent ? "mt-3 text-sm text-white/90" : "mt-3 text-sm text-muted-foreground"}>{home(`${p.id}.note`)}</p>
              <ul className="mt-6 grid flex-1 content-start gap-2.5 text-sm">
                {p.points.map((point) => (
                  <li key={point} className="flex items-start gap-2"><Check className={p.accent ? "mt-0.5 size-4 shrink-0" : "mt-0.5 size-4 shrink-0 text-pulse"} aria-hidden /> {t(`plans.${p.id}.${point}`)}</li>
                ))}
              </ul>
              <Button asChild variant={p.accent ? "dark" : "outline"} className="mt-7 self-start">
                {p.id === "selfHosted" ? <a href={p.href} rel="noopener noreferrer">{t(`planCta.${p.id}`)}</a> : <Link href={p.href}>{t(`planCta.${p.id}`)}</Link>}
              </Button>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="calculator" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start">
        <SectionHead eyebrow={t("calculator.eyebrow")} title={t("calculator.title")} body={t("calculator.body")} className="lg:sticky lg:top-24" />
        <PricingCalculator />
      </Section>

      {/* Where the money goes: a real sequence, so it is numbered */}
      <section className="border-y bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <SectionHead eyebrow={t("money.eyebrow")} title={t("money.title")} />
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {MONEY_STEPS.map((id, i) => (
              <li key={id} className="grid content-start gap-3">
                <span className={i === 2 ? "flex size-9 items-center justify-center rounded-full bg-pulse text-sm font-semibold text-white" : "flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold"}>{i + 1}</span>
                <p className="text-lg font-semibold">{t(`money.steps.${id}.title`)}</p>
                <p className="text-sm leading-6 text-muted-foreground">{t(`money.steps.${id}.text`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Section>
        <FeatureGrid />
      </Section>

      <Section className="pt-0 lg:pt-0">
        <SectionHead eyebrow={t("comparisons.eyebrow")} title={t("comparisons.title")} />
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {COMPARISONS.map((c) => (
            <li key={c.id}>
              <Link href={c.href} className="lift group flex h-full flex-col rounded-lg border bg-card p-6 shadow-card hover:shadow-lift">
                <span className="flex items-center justify-between gap-3 text-lg font-semibold">
                  {t(`comparisons.${c.id}.title`)}
                  <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-hover:translate-x-0.5 group-hover:text-foreground rtl:group-hover:-translate-x-0.5 rtl:-scale-x-100" aria-hidden />
                </span>
                <span className="mt-2 text-sm text-muted-foreground">{t(`comparisons.${c.id}.text`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <Faq title={t("faq.title")} items={FAQ.map((id) => ({ q: t(`faq.items.${id}.q`), a: t(`faq.items.${id}.a`) }))} />
      </Section>

      <CtaBand title={t("cta.title")} body={t("cta.body")} action={t("cta.button")} />
    </div>
  );
}
