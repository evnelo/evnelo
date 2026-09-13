import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, CalendarPlus, SearchX, X } from "lucide-react";
import {
  DISCOVER_PAGE_SIZE,
  calendarMonth,
  discoverDateRange,
  discoverHref,
  hasActiveFilters,
  monthOf,
  parseDiscoverFilters,
  zonedDayKey,
  type DiscoverFilters,
  type SearchParamRecord,
} from "@evnelo/core";
import type { PublicEventSearch } from "@evnelo/core/services";
import { listDiscoverableCities, listDiscoverableEvents, listDiscoverableTags } from "@/lib/queries/events";
import { publicEventPath, serializeJsonLd } from "@/lib/urls";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { DiscoverCalendar } from "@/components/discover/calendar";
import { EventCard } from "@/components/discover/event-card";
import { CustomDateForm, FilterToolbar, SearchForm, TopicChips } from "@/components/discover/filter-bar";

/**
 * Filters live in the URL, so every combination is its own shareable, crawlable page and none of
 * them can share a cached HTML payload. That rules out the old `revalidate` window: rendering is
 * per request, and the queries underneath are indexed and cheap.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<SearchParamRecord> };
type Translator = Awaited<ReturnType<typeof getTranslations<"public.discover">>>;

/** The search half of the filters, shared by the list and calendar branches. */
function searchFrom(filters: DiscoverFilters): PublicEventSearch {
  return {
    query: filters.q ?? undefined,
    city: filters.city ?? undefined,
    tag: filters.tag ?? undefined,
    price: filters.price ?? undefined,
    format: filters.format ?? undefined,
    near: filters.lat !== null && filters.lng !== null ? { lat: filters.lat, lng: filters.lng, radiusKm: filters.radiusKm } : undefined,
  };
}

/** One message per subject × place pair, so no language has to glue fragments together. */
function headline(t: Translator, filters: DiscoverFilters, tagName: string | null): string {
  const subject = filters.q ? "query" : filters.price === "free" ? "free" : tagName ? "tag" : filters.price === "paid" ? "paid" : "all";
  const place = filters.city ? "city" : filters.lat !== null ? "near" : filters.format === "online" ? "online" : filters.format === "in_person" ? "inPerson" : "none";
  return t(`headline.${subject}.${place}`, { q: filters.q ?? "", city: filters.city ?? "", tag: tagName ?? "" });
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [filters, t] = await Promise.all([searchParams.then(parseDiscoverFilters), getTranslations("public.discover")]);
  const title = headline(t, filters, filters.tag);
  // Facet pages are worth indexing; free-text searches and deep pages are not.
  const indexable = !filters.q && filters.offset === 0;
  return {
    title,
    description: t("meta.description"),
    robots: indexable ? "index,follow" : "noindex,follow",
    alternates: { canonical: `${env.APP_URL}${discoverHref(filters, { offset: 0 })}` },
  };
}

/** An icon in a soft circle, one sentence, one action. */
function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="animate-rise mx-auto mt-16 max-w-md text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground [&_svg]:size-6">{icon}</div>
      <p className="display mt-5 text-2xl">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}

const stagger = (index: number) => ({ ["--stagger" as string]: Math.min(index, 12) });

export default async function DiscoverPage({ searchParams }: Props) {
  const [filters, t, tp, tc] = await Promise.all([
    searchParams.then(parseDiscoverFilters),
    getTranslations("public.discover"),
    getTranslations("public"),
    getTranslations("common"),
  ]);
  const now = new Date();
  const today = zonedDayKey(now, filters.tz);
  const search = searchFrom(filters);

  const [tags, cities] = await Promise.all([listDiscoverableTags(18), listDiscoverableCities(60)]);
  const tagName = filters.tag ? tags.find((tag) => tag.slug === filters.tag)?.name ?? filters.tag : null;

  const grid = filters.view === "calendar" ? calendarMonth(filters.month ?? monthOf(today), filters.tz) : null;
  const range = grid ? { from: grid.from, to: grid.to } : discoverDateRange(filters, now);
  const rows = await listDiscoverableEvents({
    ...search,
    ...range,
    limit: grid ? 200 : DISCOVER_PAGE_SIZE + 1,
    offset: grid ? 0 : filters.offset,
  });

  const hasMore = !grid && rows.length > DISCOVER_PAGE_SIZE;
  const events = grid ? rows : rows.slice(0, DISCOVER_PAGE_SIZE);
  const filtered = hasActiveFilters(filters);
  const isDefaultFeed = !filtered && !grid && filters.offset === 0;
  // Featuring only pays off when a real list remains underneath it; on a quiet instance the
  // three cards would otherwise be the whole page and "Upcoming" would render empty.
  const featured = isDefaultFeed && events.length >= 6 ? events.filter((e) => e.coverImageUrl).slice(0, 3) : [];
  const featuredIds = new Set(featured.map((e) => e.id));
  const rest = featured.length > 0 ? events.filter((e) => !featuredIds.has(e.id)) : events;

  const clearAllHref = discoverHref(filters, { q: null, city: null, tag: null, date: null, from: null, to: null, price: null, format: null, lat: null, lng: null, offset: 0 });
  const customDatesLabel = filters.from && filters.to ? t("active.customRange", { from: filters.from, to: filters.to }) : filters.from ?? filters.to ?? t("active.customDates");
  const active: { label: string; href: string }[] = [
    filters.q && { label: t("active.query", { q: filters.q }), href: discoverHref(filters, { q: null, offset: 0 }) },
    filters.city && { label: filters.city, href: discoverHref(filters, { city: null, offset: 0 }) },
    tagName && { label: tagName, href: discoverHref(filters, { tag: null, offset: 0 }) },
    filters.date && { label: filters.date === "custom" ? customDatesLabel : t(`date.${filters.date}`), href: discoverHref(filters, { date: null, from: null, to: null, offset: 0 }) },
    filters.price && { label: filters.price === "free" ? tc("labels.free") : t("price.paid"), href: discoverHref(filters, { price: null, offset: 0 }) },
    filters.format && { label: t(`format.${filters.format}`), href: discoverHref(filters, { format: null, offset: 0 }) },
    filters.lat !== null && { label: t("active.within", { km: filters.radiusKm }), href: discoverHref(filters, { lat: null, lng: null, offset: 0 }) },
  ].filter((item): item is { label: string; href: string } => Boolean(item));

  const jsonLd = isDefaultFeed && events.length > 0 ? {
    "@context": "https://schema.org", "@type": "ItemList", name: t("jsonLdName"),
    itemListElement: events.slice(0, 10).map((event, index) => ({
      "@type": "ListItem", position: index + 1, url: `${env.APP_URL}${publicEventPath(event.orgSlug, event.slug)}`, name: event.name,
    })),
  } : null;

  const countKey = hasMore ? (filters.offset > 0 ? "moreFrom" : "more") : (filters.offset > 0 ? "exactFrom" : "exact");
  const countLabel = t(`count.${countKey}`, { count: events.length, from: filters.offset + 1 });

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />}

      <section className="border-b border-border/70">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 text-center sm:px-6 sm:pb-14 sm:pt-20">
          <p className="eyebrow animate-rise">{tp("nav.discover")}</p>
          <h1 className="display animate-rise mt-3 text-5xl sm:text-7xl" style={stagger(1)}>{headline(t, filters, tagName)}</h1>
          <p className="animate-rise mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg" style={stagger(2)}>
            {t("lead")}
          </p>
          <div className="animate-rise" style={stagger(3)}>
            <SearchForm filters={filters} cities={cities} />
          </div>
        </div>
      </section>

      <FilterToolbar filters={filters} />

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {(filters.date === "custom" || tags.length > 0 || active.length > 0) && (
          <div className="mt-6 space-y-4">
            <CustomDateForm filters={filters} />
            <TopicChips filters={filters} tags={tags} />
            {active.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow me-1">{t("active.showing")}</span>
                {active.map((item) => (
                  <Link key={item.label} href={item.href} className="press tap-area inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground ps-3.5 pe-2.5 text-[13px] font-medium text-background hover:bg-foreground/85">
                    {item.label}
                    <X className="size-3.5" aria-hidden />
                    <span className="sr-only">{t("active.remove")}</span>
                  </Link>
                ))}
                <Link href={clearAllHref} className="press tap-area inline-flex h-9 items-center px-2 text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground">
                  {t("active.clearAll")}
                </Link>
              </div>
            )}
          </div>
        )}

        {grid ? (
          <>
            <DiscoverCalendar grid={grid} events={events} filters={filters} today={today} />
            {events.length === 0 && (
              <EmptyState
                icon={<CalendarPlus />}
                title={t("empty.month.title")}
                body={t("empty.month.body")}
                action={<Link href={discoverHref(filters, { month: grid.next, offset: 0 })} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>{t("empty.month.action")} <ArrowRight className="rtl:-scale-x-100" /></Link>}
              />
            )}
          </>
        ) : events.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={<SearchX />}
              title={t("empty.filtered.title")}
              body={t("empty.filtered.body")}
              action={<Link href={clearAllHref} className={cn(buttonVariants({ size: "lg" }))}>{t("empty.filtered.action")}</Link>}
            />
          ) : filters.offset > 0 ? (
            <EmptyState
              icon={<ArrowLeft className="rtl:-scale-x-100" />}
              title={t("empty.end.title")}
              body={t("empty.end.body")}
              action={<Link href={discoverHref(filters, { offset: 0 })} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}><ArrowLeft className="rtl:-scale-x-100" /> {t("empty.end.action")}</Link>}
            />
          ) : (
            <EmptyState
              icon={<CalendarPlus />}
              title={t("empty.none.title")}
              body={t("empty.none.body")}
              action={<Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }))}>{tp("nav.host")}</Link>}
            />
          )
        ) : (
          <>
            {featured.length > 0 && (
              <section className="mt-12">
                <div className="flex items-baseline justify-between">
                  <h2 className="display text-3xl">{t("sections.featured")}</h2>
                </div>
                <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
                  {featured.map((event, index) => (
                    <li key={event.id} className={cn("animate-rise", index === 0 && "sm:col-span-2 lg:row-span-2")} style={stagger(index)}>
                      <EventCard event={event} variant={index === 0 ? "featured" : "compact"} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {rest.length > 0 && (
              <section className="mt-12">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="display text-3xl">{isDefaultFeed ? t("sections.upcoming") : countLabel}</h2>
                  {isDefaultFeed && <span className="text-sm text-muted-foreground tabular-nums">{countLabel}</span>}
                </div>
                <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((event, index) => (
                    <li key={event.id} className="animate-rise" style={stagger(featured.length + index)}>
                      <EventCard event={event} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(hasMore || filters.offset > 0) && (
              <nav className="mt-14 flex items-center justify-center gap-3" aria-label={t("pagination.label")}>
                {filters.offset > 0 && (
                  <Link href={discoverHref(filters, { offset: Math.max(filters.offset - DISCOVER_PAGE_SIZE, 0) })} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full")}>
                    <ArrowLeft className="rtl:-scale-x-100" /> {tc("actions.back")}
                  </Link>
                )}
                {hasMore && (
                  <Link href={discoverHref(filters, { offset: filters.offset + DISCOVER_PAGE_SIZE })} className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>
                    {t("pagination.more")} <ArrowRight className="rtl:-scale-x-100" />
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}
