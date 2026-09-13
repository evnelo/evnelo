import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { CalendarPlus, Globe } from "lucide-react";
import { events, organizations } from "@evnelo/db";
import { db } from "@/lib/db";
import { SocialLinks } from "@/components/event/social-links";
import { EventCard, type CardEvent } from "@/components/discover/event-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const [org] = await db.select().from(organizations).where(and(eq(organizations.slug, slug), isNull(organizations.deletedAt))).limit(1);
  if (!org) return null;
  const now = new Date();
  const listed = and(eq(events.organizationId, org.id), eq(events.visibility, "public"), eq(events.status, "published"), isNull(events.deletedAt));
  const [upcoming, past] = await Promise.all([
    db.select().from(events).where(and(listed, gte(events.endsAt, now))).orderBy(asc(events.startsAt)).limit(48),
    db.select().from(events).where(and(listed, lt(events.endsAt, now))).orderBy(desc(events.startsAt)).limit(12),
  ]);
  return { org, upcoming, past };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [data, t] = await Promise.all([params.then((p) => load(p.slug)), getTranslations("public.org")]);
  return data ? { title: data.org.name, description: t("meta.description", { name: data.org.name }) } : {};
}

const stagger = (index: number) => ({ ["--stagger" as string]: Math.min(index, 12) }) as React.CSSProperties;

export default async function OrgPage({ params }: Params) {
  const [data, t] = await Promise.all([params.then((p) => load(p.slug)), getTranslations("public.org")]);
  if (!data) notFound();
  const { org, upcoming, past } = data;
  const toCard = (e: (typeof upcoming)[number]): CardEvent => ({
    id: e.id, slug: e.slug, name: e.name, coverImageUrl: e.coverImageUrl, startsAt: e.startsAt, timezone: e.timezone,
    city: e.city, locationType: e.locationType, venueName: e.venueName, orgName: org.name, orgSlug: org.slug,
  });
  const initials = org.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="animate-rise flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
        {org.logoUrl ? (
          <img src={org.logoUrl} alt="" className="size-20 rounded-2xl border border-border/80 bg-card object-contain p-2 shadow-card sm:size-24" />
        ) : (
          <span aria-hidden className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-accent font-display text-3xl text-accent-foreground shadow-card sm:size-24">{initials}</span>
        )}
        <div className="min-w-0">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="display mt-1 text-4xl sm:text-6xl">{org.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {org.website && (
              <a href={org.website} className="inline-flex min-h-8 items-center gap-1.5 underline-offset-4 hover:text-foreground hover:underline" target="_blank" rel="noopener noreferrer">
                <Globe className="size-3.5" aria-hidden />{org.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            <SocialLinks links={org.socialLinks} />
          </div>
        </div>
      </header>

      <section className="hairline mt-12 pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="display text-3xl">{t("upcoming")}</h2>
          {upcoming.length > 0 && <span className="text-sm text-muted-foreground tabular-nums">{t("count", { count: upcoming.length })}</span>}
        </div>
        {upcoming.length === 0 ? (
          <div className="animate-rise mx-auto mt-10 max-w-md text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground"><CalendarPlus className="size-6" aria-hidden /></div>
            <p className="display mt-5 text-2xl">{t("empty.title")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("empty.body")}</p>
            <div className="mt-6"><Link href="/discover" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>{t("empty.action")}</Link></div>
          </div>
        ) : (
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e, index) => (
              <li key={e.id} className="animate-rise" style={stagger(index)}><EventCard event={toCard(e)} /></li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="hairline mt-12 pt-8">
          <h2 className="display text-3xl">{t("past")}</h2>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((e, index) => (
              <li key={e.id} className="animate-rise opacity-90" style={stagger(index)}><EventCard event={toCard(e)} /></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
