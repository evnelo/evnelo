import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarDays, LayoutGrid, MapPin, Search, X } from "lucide-react";
import { DEFAULT_RADIUS_KM, DISCOVER_RADII_KM, discoverHref, discoverParams, type DiscoverFilters } from "@evnelo/core";
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
        "press tap-area inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
        className,
      )}
    >
      {children}
    </Link>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

const DATE_PRESETS = ["today", "week", "month", "custom"] as const satisfies readonly NonNullable<DiscoverFilters["date"]>[];

const toggle = <T,>(current: T, value: T) => (current === value ? null : value);

const bareInput = "h-11 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0";

/**
 * The hero search: query and city in one pill, "Near me" beside it. Everything else the visitor
 * already picked rides along as hidden fields so a search never silently drops their chips.
 */
export function SearchForm({ filters, cities }: { filters: DiscoverFilters; cities: City[] }) {
  const t = useTranslations("public.discover.search");
  const tc = useTranslations("common");
  const carried = discoverParams(filters, { q: null, city: null, offset: 0 });
  return (
    <form method="get" action="/discover" role="search" className="mx-auto mt-8 w-full max-w-3xl">
      {[...carried.entries()].map(([name, value]) => <input key={`${name}=${value}`} type="hidden" name={name} value={value} />)}

      <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-1.5 shadow-card transition-shadow duration-200 focus-within:shadow-lift sm:flex-row sm:items-center sm:rounded-full">
        <label className="flex min-w-0 flex-1 items-center gap-2.5 ps-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">{t("events")}</span>
          <Input name="q" defaultValue={filters.q ?? ""} placeholder={t("placeholder")} aria-label={t("events")} className={bareInput} />
        </label>
        <span aria-hidden className="hidden h-7 w-px shrink-0 bg-border sm:block" />
        <span aria-hidden className="mx-3 h-px bg-border sm:hidden" />
        <label className="flex items-center gap-2.5 ps-3 sm:w-52">
          <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">{t("city")}</span>
          <Input name="city" defaultValue={filters.city ?? ""} placeholder={t("city")} aria-label={t("city")} list="discover-cities" className={bareInput} />
          <datalist id="discover-cities">
            {cities.map((c) => <option key={`${c.city}-${c.country ?? ""}`} value={c.city} label={c.country ? t("cityOption", { city: c.city, country: c.country }) : c.city} />)}
          </datalist>
        </label>
        <Button type="submit" size="lg" className="mt-1 h-11 rounded-xl sm:ms-1 sm:mt-0 sm:rounded-full">{tc("actions.search")}</Button>
      </div>
      <div className="mt-3 flex justify-center">
        <NearMeButton query={carried.toString()} active={filters.lat !== null} />
      </div>
    </form>
  );
}

/** The compact glass toolbar that sticks under the header: date, price and format chips plus the view toggle. */
export function FilterToolbar({ filters }: { filters: DiscoverFilters }) {
  const t = useTranslations("public.discover");
  const tc = useTranslations("common");
  const calendar = filters.view === "calendar";
  const segment = (active: boolean) => cn(
    "press tap-area inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
    active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
  );
  return (
    <section aria-label={t("toolbar.label")} className="surface-glass sticky top-28 z-30 md:top-16 border-b border-border/70">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 py-1 [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] rtl:[mask-image:linear-gradient(to_left,black_calc(100%-1.5rem),transparent)] lg:[mask-image:none]">
          {!calendar && (
            <>
              {DATE_PRESETS.map((value) => (
                <Chip key={value} href={discoverHref(filters, { date: toggle(filters.date, value), from: null, to: null, offset: 0 })} active={filters.date === value}>
                  {t(`date.${value}`)}
                </Chip>
              ))}
              <Divider />
            </>
          )}
          <Chip href={discoverHref(filters, { price: toggle(filters.price, "free"), offset: 0 })} active={filters.price === "free"}>{tc("labels.free")}</Chip>
          <Chip href={discoverHref(filters, { price: toggle(filters.price, "paid"), offset: 0 })} active={filters.price === "paid"}>{t("price.paid")}</Chip>
          <Divider />
          <Chip href={discoverHref(filters, { format: toggle(filters.format, "in_person"), offset: 0 })} active={filters.format === "in_person"}>{t("format.in_person")}</Chip>
          <Chip href={discoverHref(filters, { format: toggle(filters.format, "online"), offset: 0 })} active={filters.format === "online"}>{t("format.online")}</Chip>
          {filters.lat !== null && (
            <>
              <Divider />
              {DISCOVER_RADII_KM.map((km) => (
                <Chip key={km} href={discoverHref(filters, { radiusKm: km, offset: 0 })} active={filters.radiusKm === km}>{t("toolbar.km", { km })}</Chip>
              ))}
              <Chip href={discoverHref(filters, { lat: null, lng: null, radiusKm: DEFAULT_RADIUS_KM, offset: 0 })}><X className="size-3" aria-hidden />{t("toolbar.anywhere")}</Chip>
            </>
          )}
        </div>

        <div className="ms-auto inline-flex shrink-0 rounded-full border border-border/80 bg-card p-0.5" role="group" aria-label={t("toolbar.view")}>
          <Link href={discoverHref(filters, { view: "list", month: null, offset: 0 })} aria-current={!calendar ? "page" : undefined} className={segment(!calendar)}>
            <LayoutGrid className="size-3.5" aria-hidden /> {t("toolbar.list")}
          </Link>
          <Link href={discoverHref(filters, { view: "calendar", date: null, from: null, to: null, offset: 0 })} aria-current={calendar ? "page" : undefined} className={segment(calendar)}>
            <CalendarDays className="size-3.5" aria-hidden /> {t("toolbar.calendar")}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** The from/to form that appears once "Pick dates" is chosen. */
export function CustomDateForm({ filters }: { filters: DiscoverFilters }) {
  const t = useTranslations("public.discover.customDates");
  if (filters.date !== "custom") return null;
  return (
    <form method="get" action="/discover" className="animate-rise flex flex-wrap items-end gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-card">
      {[...discoverParams(filters, { date: null, from: null, to: null, offset: 0 }).entries()].map(([name, value]) => (
        <input key={`${name}=${value}`} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="date" value="custom" />
      <label className="eyebrow">
        {t("from")}
        <Input type="date" name="from" defaultValue={filters.from ?? ""} className="mt-1.5 h-11 w-44 normal-case tracking-normal text-foreground" />
      </label>
      <label className="eyebrow">
        {t("to")}
        <Input type="date" name="to" defaultValue={filters.to ?? ""} className="mt-1.5 h-11 w-44 normal-case tracking-normal text-foreground" />
      </label>
      <Button type="submit" variant="outline" className="h-11">{t("apply")}</Button>
      <Link href={discoverHref(filters, { date: null, from: null, to: null, offset: 0 })} className="press inline-flex h-11 items-center px-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">{t("clear")}</Link>
    </form>
  );
}

/** Topic chips with counts. Not sticky: they are a way in, not a control you keep adjusting. */
export function TopicChips({ filters, tags }: { filters: DiscoverFilters; tags: Tag[] }) {
  const t = useTranslations("public.discover");
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow me-1">{t("topics")}</span>
      {tags.map((tag) => (
        <Chip key={tag.slug} href={discoverHref(filters, { tag: toggle(filters.tag, tag.slug), offset: 0 })} active={filters.tag === tag.slug}>
          {tag.name}
          <span className="tabular-nums opacity-60">{tag.count}</span>
        </Chip>
      ))}
    </div>
  );
}
