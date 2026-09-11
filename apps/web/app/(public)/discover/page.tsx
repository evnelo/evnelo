import type { Metadata } from "next";
import Link from "next/link";
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
} from "@ot/core";
import type { PublicEventSearch } from "@ot/core/services";
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

function headline(filters: DiscoverFilters, tagName: string | null): string {
  const subject = filters.q ? `Events matching “${filters.q}”` : filters.price === "free" ? "Free events" : tagName ? `${tagName} events` : filters.price === "paid" ? "Ticketed events" : "Events";
  const place = filters.city ? ` in ${filters.city}` : filters.lat !== null ? " near you" : filters.format === "online" ? " online" : filters.format === "in_person" ? " in person" : "";
  return subject === "Events" && !place ? "What's on" : `${subject}${place}`;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const filters = parseDiscoverFilters(await searchParams);
  const title = headline(filters, filters.tag);
  // Facet pages are worth indexing; free-text searches and deep pages are not.
  const indexable = !filters.q && filters.offset === 0;
  return {
    title,
    description: "Public events from every host on Evnelo. Search by city, topic, date, price and distance.",
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
  const filters = parseDiscoverFilters(await searchParams);
  const now = new Date();
  const today = zonedDayKey(now, filters.tz);
  const search = searchFrom(filters);

  const [tags, cities] = await Promise.all([listDiscoverableTags(18), listDiscoverableCities(60)]);
  const tagName = filters.tag ? tags.find((t) => t.slug === filters.tag)?.name ?? filters.tag : null;

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
  const active: { label: string; href: string }[] = [
    filters.q && { label: `“${filters.q}”`, href: discoverHref(filters, { q: null, offset: 0 }) },
    filters.city && { label: filters.city, href: discoverHref(filters, { city: null, offset: 0 }) },
    tagName && { label: tagName, href: discoverHref(filters, { tag: null, offset: 0 }) },
    filters.date && { label: filters.date === "custom" ? [filters.from, filters.to].filter(Boolean).join(" to ") || "Custom dates" : { today: "Today", week: "This week", month: "This month" }[filters.date], href: discoverHref(filters, { date: null, from: null, to: null, offset: 0 }) },
    filters.price && { label: filters.price === "free" ? "Free" : "Paid", href: discoverHref(filters, { price: null, offset: 0 }) },
    filters.format && { label: filters.format === "online" ? "Online" : "In person", href: discoverHref(filters, { format: null, offset: 0 }) },
    filters.lat !== null && { label: `Within ${filters.radiusKm} km`, href: discoverHref(filters, { lat: null, lng: null, offset: 0 }) },
  ].filter((item): item is { label: string; href: string } => Boolean(item));

  const jsonLd = isDefaultFeed && events.length > 0 ? {
    "@context": "https://schema.org", "@type": "ItemList", name: "Upcoming public events",
    itemListElement: events.slice(0, 10).map((event, index) => ({
      "@type": "ListItem", position: index + 1, url: `${env.APP_URL}${publicEventPath(event.orgSlug, event.slug)}`, name: event.name,
    })),
  } : null;

  const countLabel = `${events.length}${hasMore ? "+" : ""} ${events.length === 1 ? "event" : "events"}${filters.offset > 0 ? ` from #${filters.offset + 1}` : ""}`;

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />}

      <section className="border-b border-border/70">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 text-center sm:px-6 sm:pb-14 sm:pt-20">
          <p className="eyebrow animate-rise">Discover</p>
          <h1 className="display animate-rise mt-3 text-5xl sm:text-7xl" style={stagger(1)}>{headline(filters, tagName)}</h1>
          <p className="animate-rise mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg" style={stagger(2)}>
            Talks, workshops, dinners and meetups from every host on Evnelo.
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
                <span className="eyebrow mr-1">Showing</span>
                {active.map((item) => (
                  <Link key={item.label} href={item.href} className="press tap-area inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground pl-3.5 pr-2.5 text-[13px] font-medium text-background hover:bg-foreground/85">
                    {item.label}
                    <X className="size-3.5" aria-hidden />
                    <span className="sr-only">Remove filter</span>
                  </Link>
                ))}
                <Link href={clearAllHref} className="press tap-area inline-flex h-9 items-center px-2 text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground">
                  Clear all
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
                title="Nothing scheduled this month."
                body="Try another month or clear a filter."
                action={<Link href={discoverHref(filters, { month: grid.next, offset: 0 })} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>Next month <ArrowRight /></Link>}
              />
            )}
          </>
        ) : events.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={<SearchX />}
              title="No events match these filters."
              body="Try a wider date range or clear the filters."
              action={<Link href={clearAllHref} className={cn(buttonVariants({ size: "lg" }))}>Clear the filters</Link>}
            />
          ) : filters.offset > 0 ? (
            <EmptyState
              icon={<ArrowLeft />}
              title="You reached the end."
              body="That is every upcoming public event on this page."
              action={<Link href={discoverHref(filters, { offset: 0 })} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}><ArrowLeft /> Back to the start</Link>}
            />
          ) : (
            <EmptyState
              icon={<CalendarPlus />}
              title="No upcoming public events yet."
              body="Be the first to host one."
              action={<Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }))}>Host an event</Link>}
            />
          )
        ) : (
          <>
            {featured.length > 0 && (
              <section className="mt-12">
                <div className="flex items-baseline justify-between">
                  <h2 className="display text-3xl">Featured</h2>
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
                  <h2 className="display text-3xl">{isDefaultFeed ? "Upcoming" : countLabel}</h2>
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
              <nav className="mt-14 flex items-center justify-center gap-3" aria-label="Pagination">
                {filters.offset > 0 && (
                  <Link href={discoverHref(filters, { offset: Math.max(filters.offset - DISCOVER_PAGE_SIZE, 0) })} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full")}>
                    <ArrowLeft /> Back
                  </Link>
                )}
                {hasMore && (
                  <Link href={discoverHref(filters, { offset: filters.offset + DISCOVER_PAGE_SIZE })} className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>
                    Load more <ArrowRight />
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
