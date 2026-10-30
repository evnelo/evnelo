import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BellRing, ChevronDown, Code2, Lock, ScanLine, Tags, TextCursorInput, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlowLine } from "@/components/marketing/flow-line";
import { cn } from "@/lib/utils";

/**
 * Building blocks for the ad landing pages (/pricing, /compare/*, /brasil): the same widths, gutters and
 * type scale as the home page, so a visitor arriving from an ad and clicking through sees one site.
 */

export function LandingHero({ eyebrow, title, body, actions, aside }: {
  eyebrow: React.ReactNode; title: React.ReactNode; body: React.ReactNode; actions: React.ReactNode; aside?: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-12 pt-14 sm:px-6 sm:pt-20 lg:pb-16">
      <div className={cn("grid gap-10", aside && "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end")}>
        <div className="animate-rise min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display mt-3 max-w-3xl text-[2.5rem] sm:text-6xl">{title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{body}</p>
          <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
        </div>
        {aside && <div className="min-w-0">{aside}</div>}
      </div>
    </section>
  );
}

export function SectionHead({ eyebrow, title, body, className }: { eyebrow?: React.ReactNode; title: React.ReactNode; body?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className={cn("display text-4xl", eyebrow && "mt-3")}>{title}</h2>
      {body && <p className="mt-4 text-muted-foreground">{body}</p>}
    </div>
  );
}

export function Section({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cn("mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20", className)}>{children}</section>;
}

/** Rows of facts, Evnelo's column first and marked. Scrolls sideways on its own on phones. */
export function ComparisonTable({ caption, featureLabel, columns, rows }: {
  caption: string; featureLabel: string; columns: string[]; rows: { label: string; values: string[] }[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
      <table className="w-full min-w-[36rem] border-collapse text-start text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="p-4 text-start font-medium text-muted-foreground">{featureLabel}</th>
            {columns.map((c, i) => (
              <th key={c} scope="col" className={cn("p-4 text-start text-base font-semibold", i === 0 && "border-s-2 border-s-pulse bg-muted/40")}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b last:border-b-0">
              <th scope="row" className="p-4 text-start font-medium text-muted-foreground">{r.label}</th>
              {r.values.map((v, i) => <td key={i} className={cn("p-4 align-top", i === 0 && "border-s-2 border-s-pulse bg-muted/40 font-semibold")}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Native disclosure: works without script, keyboard and screen readers get it for free. */
export function Faq({ title, items }: { title: string; items: { q: string; a: React.ReactNode }[] }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <h2 className="display text-4xl">{title}</h2>
      <div className="divide-y border-y">
        {items.map((item) => (
          <details key={item.q} className="group">
            <summary className="press flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-open:rotate-180" aria-hidden />
            </summary>
            <p className="max-w-prose pb-6 leading-7 text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

export function CtaBand({ title, body, action, href = "/login" }: { title: string; body: string; action: string; href?: string }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <div className="relative overflow-hidden rounded-xl bg-ink px-6 py-12 text-paper sm:px-12 sm:py-16">
        <FlowLine className="pointer-events-none absolute -end-10 top-6 hidden w-[28rem] opacity-90 lg:block" />
        <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="display text-4xl sm:text-5xl">{title}</h2>
            <p className="mt-3 max-w-lg text-paper/75">{body}</p>
          </div>
          <Button asChild size="lg"><Link href={href}>{action}</Link></Button>
        </div>
      </div>
    </section>
  );
}

export function SourceNote({ children }: { children: React.ReactNode }) {
  return <p className="mx-auto max-w-6xl px-4 pb-10 text-xs leading-5 text-muted-foreground sm:px-6 [&_a]:underline [&_a]:underline-offset-2">{children}</p>;
}

const FEATURES = [
  { id: "tiers", icon: Tags },
  { id: "questions", icon: TextCursorInput },
  { id: "guests", icon: UserPlus },
  { id: "waitlist", icon: Users },
  { id: "private", icon: Lock },
  { id: "checkin", icon: ScanLine },
  { id: "messages", icon: BellRing },
  { id: "api", icon: Code2 },
] as const;

/** Everything a host gets, on every plan: the answer to "what do I lose by switching". */
export async function FeatureGrid() {
  const t = await getTranslations("public.features");
  return (
    <>
      <SectionHead title={t("title")} body={t("body")} />
      <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ id, icon: Icon }) => (
          <li key={id} className="grid content-start gap-2">
            <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground"><Icon className="size-5" aria-hidden /></span>
            <p className="mt-2 font-semibold">{t(`items.${id}.title`)}</p>
            <p className="text-sm leading-6 text-muted-foreground">{t(`items.${id}.text`)}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
