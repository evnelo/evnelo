import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
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
import { DiscoverCalendar } from "@/components/discover/calendar";
import { EventCard } from "@/components/discover/event-card";
import { FilterBar } from "@/components/discover/filter-bar";

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
    description: "Public events from every host on OpenTicket. Search by city, topic, date, price and distance.",
    robots: indexable ? "index,follow" : "noindex,follow",
    alternates: { canonical: `${env.APP_URL}${discoverHref(filters, { offset: 0 })}` },
  };
}

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />}

      <h1 className="display text-5xl sm:text-6xl">{headline(filters, tagName)}</h1>
      <p className="mt-3 max-w-prose text-muted-foreground">
        Public events from every host on the platform. Free events are free to run; paid events cost the host 0.99%.
      </p>

      <FilterBar filters={filters} tags={tags} cities={cities} />

      {active.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {active.map((item) => (
            <Link key={item.label} href={item.href} className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-1 text-xs hover:bg-muted">
              {item.label}
              <X className="size-3" />
              <span className="sr-only">Remove filter</span>
            </Link>
          ))}
          <Link href={discoverHref(filters, { q: null, city: null, tag: null, date: null, from: null, to: null, price: null, format: null, lat: null, lng: null, offset: 0 })} className="text-xs underline underline-offset-4">
            Clear all
          </Link>
        </div>
      )}

      {grid ? (
        <>
          <DiscoverCalendar grid={grid} events={events} filters={filters} today={today} />
          {events.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">Nothing scheduled this month. Try another month or clear a filter.</p>
          )}
        </>
      ) : events.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed p-10 text-center">
          {filtered ? (
            <>
              <p className="font-medium">No events match these filters.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a wider date range or{" "}
                <Link href={discoverHref(filters, { q: null, city: null, tag: null, date: null, from: null, to: null, price: null, format: null, lat: null, lng: null, offset: 0 })} className="underline underline-offset-4">
                  clear the filters
                </Link>.
              </p>
            </>
          ) : filters.offset > 0 ? (
            <>
              <p className="font-medium">You reached the end.</p>
              <p className="mt-1 text-sm text-muted-foreground"><Link href={discoverHref(filters, { offset: 0 })} className="underline underline-offset-4">Back to the start</Link>.</p>
            </>
          ) : (
            <>
              <p className="font-medium">No upcoming public events yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">Be the first: <Link href="/dashboard" className="underline underline-offset-4">host an event</Link>.</p>
            </>
          )}
        </div>
      ) : (
        <>
          {featured.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-medium text-muted-foreground">Featured</h2>
              <ul className="mt-4 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((event) => <li key={event.id}><EventCard event={event} featured /></li>)}
              </ul>
            </section>
          )}

          {rest.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-medium text-muted-foreground">
                {isDefaultFeed ? "Upcoming" : `${events.length}${hasMore ? "+" : ""} ${events.length === 1 ? "event" : "events"}${filters.offset > 0 ? ` from #${filters.offset + 1}` : ""}`}
              </h2>
              <ul className="mt-4 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((event) => <li key={event.id}><EventCard event={event} /></li>)}
              </ul>
            </section>
          )}

          {(hasMore || filters.offset > 0) && (
            <nav className="mt-12 flex items-center justify-center gap-3" aria-label="Pagination">
              {filters.offset > 0 && (
                <Link href={discoverHref(filters, { offset: Math.max(filters.offset - DISCOVER_PAGE_SIZE, 0) })} className="inline-flex h-10 items-center rounded-md border bg-card px-4 text-sm hover:bg-muted">
                  Back
                </Link>
              )}
              {hasMore && (
                <Link href={discoverHref(filters, { offset: filters.offset + DISCOVER_PAGE_SIZE })} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Load more
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
