import Link from "next/link";
import { CalendarDays, LayoutGrid, Search, X } from "lucide-react";
import { DEFAULT_RADIUS_KM, DISCOVER_RADII_KM, discoverHref, discoverParams, type DiscoverFilters } from "@ot/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NearMeButton } from "@/components/discover/near-me-button";
import { cn } from "@/lib/utils";

type Tag = { slug: string; name: string; count: number };
type City = { city: string; country: string | null; count: number };

/** A filter pill. Selecting is a plain link, so every filter combination has its own URL. */
function Chip({ href, active, children, className }: { href: string; active?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
        className,
      )}
    >
      {children}
    </Link>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

const DATE_LABELS: { value: DiscoverFilters["date"]; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Pick dates" },
];

export function FilterBar({ filters, tags, cities }: { filters: DiscoverFilters; tags: Tag[]; cities: City[] }) {
  // The text form owns q and city; everything else rides along as hidden fields so a search
  // never silently drops the chips the visitor already picked.
  const carried = discoverParams(filters, { q: null, city: null, offset: 0 });
  const toggle = <T,>(current: T, value: T) => (current === value ? null : value);
  const calendar = filters.view === "calendar";

  return (
    <section aria-label="Filters" className="mt-8 space-y-4">
      <form method="get" action="/discover" className="flex flex-wrap items-start gap-2">
        {[...carried.entries()].map(([name, value]) => <input key={`${name}=${value}`} type="hidden" name={name} value={value} />)}

        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={filters.q ?? ""} placeholder="Search events, hosts and tags" aria-label="Search events" className="pl-9" />
        </div>

        <div className="min-w-40 flex-1 sm:max-w-56">
          <Input name="city" defaultValue={filters.city ?? ""} placeholder="City" aria-label="City" list="discover-cities" />
          <datalist id="discover-cities">
            {cities.map((c) => <option key={`${c.city}-${c.country ?? ""}`} value={c.city} label={c.country ? `${c.city}, ${c.country}` : c.city} />)}
          </datalist>
        </div>

        <Button type="submit">Search</Button>
        <NearMeButton query={carried.toString()} active={filters.lat !== null} />
      </form>

      {filters.date === "custom" && (
        <form method="get" action="/discover" className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
          {[...discoverParams(filters, { date: null, from: null, to: null, offset: 0 }).entries()].map(([name, value]) => (
            <input key={`${name}=${value}`} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="date" value="custom" />
          <label className="text-xs text-muted-foreground">
            From
            <Input type="date" name="from" defaultValue={filters.from ?? ""} className="mt-1 w-40" />
          </label>
          <label className="text-xs text-muted-foreground">
            To
            <Input type="date" name="to" defaultValue={filters.to ?? ""} className="mt-1 w-40" />
          </label>
          <Button type="submit" variant="outline">Apply dates</Button>
          <Link href={discoverHref(filters, { date: null, from: null, to: null, offset: 0 })} className="px-2 py-2 text-xs text-muted-foreground underline underline-offset-4">Clear dates</Link>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {!calendar && (
          <ChipGroup label="When">
            {DATE_LABELS.map(({ value, label }) => (
              <Chip key={value} href={discoverHref(filters, { date: toggle(filters.date, value), from: null, to: null, offset: 0 })} active={filters.date === value}>
                {label}
              </Chip>
            ))}
          </ChipGroup>
        )}

        <ChipGroup label="Price">
          <Chip href={discoverHref(filters, { price: toggle(filters.price, "free"), offset: 0 })} active={filters.price === "free"}>Free</Chip>
          <Chip href={discoverHref(filters, { price: toggle(filters.price, "paid"), offset: 0 })} active={filters.price === "paid"}>Paid</Chip>
        </ChipGroup>

        <ChipGroup label="Where">
          <Chip href={discoverHref(filters, { format: toggle(filters.format, "in_person"), offset: 0 })} active={filters.format === "in_person"}>In person</Chip>
          <Chip href={discoverHref(filters, { format: toggle(filters.format, "online"), offset: 0 })} active={filters.format === "online"}>Online</Chip>
        </ChipGroup>

        {filters.lat !== null && (
          <ChipGroup label="Within">
            {DISCOVER_RADII_KM.map((km) => (
              <Chip key={km} href={discoverHref(filters, { radiusKm: km, offset: 0 })} active={filters.radiusKm === km}>{km} km</Chip>
            ))}
            <Chip href={discoverHref(filters, { lat: null, lng: null, radiusKm: DEFAULT_RADIUS_KM, offset: 0 })}><X className="size-3" />Anywhere</Chip>
          </ChipGroup>
        )}

        <div className="ms-auto inline-flex rounded-md border bg-card p-0.5">
          <Link
            href={discoverHref(filters, { view: "list", month: null, offset: 0 })}
            aria-current={!calendar ? "page" : undefined}
            className={cn("inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium", !calendar ? "bg-secondary" : "text-muted-foreground hover:text-foreground")}
          >
            <LayoutGrid className="size-3.5" /> List
          </Link>
          <Link
            href={discoverHref(filters, { view: "calendar", date: null, from: null, to: null, offset: 0 })}
            aria-current={calendar ? "page" : undefined}
            className={cn("inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium", calendar ? "bg-secondary" : "text-muted-foreground hover:text-foreground")}
          >
            <CalendarDays className="size-3.5" /> Calendar
          </Link>
        </div>
      </div>

      {tags.length > 0 && (
        <ChipGroup label="Topics">
          {tags.map((tag) => (
            <Chip key={tag.slug} href={discoverHref(filters, { tag: toggle(filters.tag, tag.slug), offset: 0 })} active={filters.tag === tag.slug}>
              {tag.name}
              <span className="tabular-nums opacity-60">{tag.count}</span>
            </Chip>
          ))}
        </ChipGroup>
      )}
    </section>
  );
}
