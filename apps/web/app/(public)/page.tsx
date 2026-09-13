import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Check, CalendarDays, Code2, ScanLine, Ticket, Users } from "lucide-react";
import { listDiscoverableEvents } from "@/lib/queries/events";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/discover/event-card";
import { Hero } from "@/components/marketing/hero";
import { GITHUB_REPO_URL } from "@/components/marketing/github-badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public");
  return {
    title: t("home.meta.title"),
    description: t("home.meta.description"),
    alternates: { canonical: "/" },
  };
}

export const dynamic = "force-dynamic";

const STEPS = [
  { id: "publish", icon: CalendarDays },
  { id: "register", icon: Users },
  { id: "pay", icon: Ticket },
  { id: "checkin", icon: ScanLine },
] as const;

const PLANS = [
  { id: "free", accent: false },
  { id: "paid", accent: true },
  { id: "selfHosted", accent: false },
] as const;

const OPEN_SOURCE_POINTS = ["export", "providers", "ops", "migrate"] as const;
const DEVELOPER_POINTS = ["rest", "sdk", "webhooks", "openapi"] as const;

export default async function HomePage() {
  const [t, upcoming] = await Promise.all([
    getTranslations("public"),
    listDiscoverableEvents({ limit: 3 }).then((rows) => rows.filter((e) => e.coverImageUrl)),
  ]);
  return (
    <div className="overflow-x-clip">
      <Hero />

      {/* Pricing band */}
      <section id="pricing" className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-end">
            <div>
              <p className="eyebrow text-paper/60">{t("home.pricing.eyebrow")}</p>
              <h2 className="display mt-3 text-4xl sm:text-5xl">{t("home.pricing.title")}</h2>
              <p className="mt-5 max-w-md text-paper/75">{t("home.pricing.body")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {PLANS.map((p) => (
                <div key={p.id} className={p.accent ? "rounded-lg bg-pulse p-6 text-white" : "rounded-lg border border-paper/15 p-6"}>
                  <p className={p.accent ? "text-sm font-medium text-white/80" : "text-sm font-medium text-paper/60"}>{t(`home.pricing.plans.${p.id}.title`)}</p>
                  <p className="display mt-3 text-5xl">{t(`home.pricing.plans.${p.id}.price`)}</p>
                  <p className={p.accent ? "mt-3 text-sm text-white/85" : "mt-3 text-sm text-paper/70"}>{t(`home.pricing.plans.${p.id}.note`)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it flows */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <p className="eyebrow">{t("home.flow.eyebrow")}</p>
        <h2 className="display mt-3 max-w-2xl text-4xl sm:text-5xl">{t("home.flow.title")}</h2>
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ id, icon: Icon }, i) => (
            <li key={id} className="animate-rise rounded-lg border bg-card p-6" style={{ "--stagger": i } as React.CSSProperties}>
              <div className="flex size-11 items-center justify-center rounded-md bg-accent text-accent-foreground"><Icon className="size-5" /></div>
              <p className="mt-5 text-lg font-semibold">{t(`home.flow.steps.${id}.title`)}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(`home.flow.steps.${id}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Open source + developers */}
      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="eyebrow">{t("home.openSource.eyebrow")}</p>
            <h2 className="display mt-3 text-4xl">{t("home.openSource.title")}</h2>
            <p className="mt-5 text-muted-foreground">{t("home.openSource.body")}</p>
            <ul className="mt-6 space-y-2 text-sm">
              {OPEN_SOURCE_POINTS.map((id) => (
                <li key={id} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-pulse" /> {t(`home.openSource.points.${id}`)}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="dark"><a href={GITHUB_REPO_URL} rel="noopener noreferrer">{t("home.openSource.source")}</a></Button>
              <Button asChild variant="outline"><a href="/api/v1/docs">{t("home.openSource.apiReference")}</a></Button>
            </div>
          </div>
          <div>
            <p className="eyebrow">{t("home.developers.eyebrow")}</p>
            <h2 className="display mt-3 text-4xl">{t("home.developers.title")}</h2>
            <ul className="mt-6 space-y-2 text-sm">
              {DEVELOPER_POINTS.map((id) => <li key={id} className="flex items-start gap-2"><Code2 className="mt-0.5 size-4 shrink-0 text-pulse" /> {t(`home.developers.points.${id}`)}</li>)}
            </ul>
            <pre className="code-panel mt-8 overflow-x-auto p-5" dir="ltr"><code>{`import { createEvneloClient } from "@evnelo/sdk";

const evnelo = createEvneloClient({
  baseUrl: "https://evnelo.com",
  apiKey: process.env.EVNELO_API_KEY,
});

const { data } = await evnelo.GET("/api/v1/events");`}</code></pre>
          </div>
        </div>
      </section>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">{t("home.upcoming.eyebrow")}</p>
              <h2 className="display mt-3 text-4xl">{t("home.upcoming.title")}</h2>
            </div>
            <Link href="/discover" className="press inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">{t("home.upcoming.all")} <ArrowRight className="size-4 rtl:-scale-x-100" /></Link>
          </div>
          <ul className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e, i) => <li key={e.id} className="animate-rise" style={{ "--stagger": i } as React.CSSProperties}><EventCard event={e} /></li>)}
          </ul>
        </section>
      )}

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="rounded-xl bg-pulse px-6 py-12 text-white sm:px-12 sm:py-16">
          <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="display text-4xl sm:text-5xl">{t("home.cta.title")}</h2>
              <p className="mt-3 max-w-lg text-white/85">{t("home.cta.body")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="dark"><Link href="/login">{t("nav.host")}</Link></Button>
              <Button asChild size="lg" className="bg-white text-ink hover:bg-white/90"><Link href="/discover">{t("home.cta.explore")}</Link></Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
