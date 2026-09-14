import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { MapPin, Video } from "lucide-react";
import type { PublicEvent } from "@evnelo/core/services";
import { publicEventPath } from "@/lib/urls";
import { cn, formatMoney } from "@/lib/utils";

/** What a card needs. Pricing and distance are optional so pages without a price summary (an organizer's page) can reuse it. */
export type CardEvent = Pick<PublicEvent, "id" | "slug" | "name" | "coverImageUrl" | "startsAt" | "timezone" | "city" | "locationType" | "venueName" | "orgName" | "orgSlug"> &
  Partial<Pick<PublicEvent, "isFree" | "minPriceMinor" | "currency" | "distanceKm">>;

/** Null when the card has no price summary; otherwise whether nothing is charged, plus the cheapest visible tier. */
function pricing(event: CardEvent): { free: boolean; minor: number; currency: string } | null {
  if (event.isFree === undefined || event.minPriceMinor === undefined) return null;
  const free = event.isFree || event.minPriceMinor === null || event.minPriceMinor === 0;
  return { free, minor: event.minPriceMinor ?? 0, currency: event.currency ?? "USD" };
}

function whenLabel(event: Pick<PublicEvent, "startsAt" | "timezone">, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", hour: "numeric", timeZone: event.timezone }).format(event.startsAt);
}

function leafParts(event: Pick<PublicEvent, "startsAt" | "timezone">, locale: string) {
  return {
    month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: event.timezone }).format(event.startsAt),
    day: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: event.timezone }).format(event.startsAt),
  };
}

function PlaceIcon({ event, className }: { event: CardEvent; className?: string }) {
  const Icon = event.locationType === "online" ? Video : MapPin;
  return <Icon className={cn("size-3.5 shrink-0", className)} aria-hidden />;
}

type Variant = "default" | "featured" | "compact";

const focusRing = "group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * The discovery card. `featured` is the wide, image-led card at the top of the feed (date leaf and
 * price over a scrim); `compact` runs image-beside-text so two of them stack next to a featured card.
 */
export function EventCard({ event, variant = "default", className }: { event: CardEvent; variant?: Variant; className?: string }) {
  const t = useTranslations("public.discover");
  const tc = useTranslations("common");
  const locale = useLocale();
  const distanceKm = event.distanceKm ?? null;
  const distance = distanceKm === null ? null : distanceKm < 1 ? t("card.underOneKm") : t("card.kmAway", { km: Math.round(distanceKm) });
  const where = event.locationType === "online" ? t("format.online") : event.city ?? event.venueName ?? (event.locationType === "hybrid" ? t("format.hybrid") : null);
  const priced = pricing(event);
  const price = priced === null ? null : priced.free ? tc("labels.free") : t("card.from", { price: formatMoney(priced.minor, priced.currency, locale) });
  const free = priced?.free ?? false;
  const { month, day } = leafParts(event, locale);
  const when = whenLabel(event, locale);
  const href = publicEventPath(event.orgSlug, event.slug);

  if (variant === "featured") {
    return (
      <Link href={href} className={cn(focusRing, className)}>
        <article className="lift relative isolate flex aspect-[4/3] h-full flex-col justify-end overflow-hidden rounded-xl bg-muted shadow-card sm:aspect-[16/9] lg:aspect-auto lg:min-h-[30rem]">
          {event.coverImageUrl && <img src={event.coverImageUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-(--duration-fast) ease-smooth-out group-hover:scale-[1.03]" />}
          <div className="scrim absolute inset-0 -z-10" aria-hidden />
          <div className="date-leaf absolute start-5 top-5 border-transparent shadow-lift"><span>{month}</span><span>{day}</span></div>
          <div className="flex items-end justify-between gap-6 p-5 text-white sm:p-7">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-medium text-white/85">
                <span>{when}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1"><PlaceIcon event={event} className="text-white/85" />{event.orgName}{where ? `, ${where}` : ""}</span>
              </p>
              <h3 className="display mt-2 text-3xl text-white sm:text-4xl lg:text-5xl">{event.name}</h3>
            </div>
            {price && (
              <span className="shrink-0 rounded-full bg-white/95 px-3.5 py-1.5 font-display text-base text-foreground shadow-card">{price}</span>
            )}
          </div>
        </article>
      </Link>
    );
  }

  const compact = variant === "compact";
  return (
    <Link href={href} className={cn(focusRing, className)}>
      <article className={cn("lift flex h-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-card", compact && "lg:flex-row")}>
        <div className={cn("relative aspect-[4/3] shrink-0", compact && "lg:aspect-auto lg:w-[36%]")}>
          <div className="absolute inset-0 overflow-hidden bg-muted">
            {event.coverImageUrl ? (
              <img src={event.coverImageUrl} alt="" className="size-full object-cover transition-transform duration-(--duration-fast) ease-smooth-out group-hover:scale-[1.03]" loading="lazy" />
            ) : (
              <div className="flex size-full items-center justify-center font-display text-7xl text-muted-foreground/30" aria-hidden>{day}</div>
            )}
          </div>
          <div className={cn("date-leaf absolute bottom-0 start-4 z-10 translate-y-1/2 shadow-card", compact && "lg:bottom-auto lg:start-3 lg:top-3 lg:translate-y-0")}><span>{month}</span><span>{day}</span></div>
        </div>
        <div className={cn("flex flex-1 flex-col p-5 pt-10", compact && "lg:p-5")}>
          <p className="text-[13px] font-medium text-muted-foreground">{when}</p>
          <h3 className={cn("display mt-1.5 text-2xl", compact && "lg:text-xl")}>{event.name}</h3>
          <div className="mt-auto flex items-end justify-between gap-3 pt-4 text-sm text-muted-foreground">
            <p className="flex min-w-0 flex-wrap items-center gap-x-1.5">
              <PlaceIcon event={event} />
              <span>{event.orgName}</span>
              {where && <span>· {where}</span>}
              {distance && <span>· {distance}</span>}
            </p>
            {price && <span className={cn("shrink-0 font-display text-base text-foreground", free && "text-accent-foreground")}>{price}</span>}
          </div>
        </div>
      </article>
    </Link>
  );
}

/** Compact row used inside calendar cells, where there is no room for a cover image. */
export function EventRow({ event }: { event: PublicEvent }) {
  const t = useTranslations("public.discover.calendar");
  const locale = useLocale();
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: event.timezone }).format(event.startsAt);
  return (
    <Link
      href={publicEventPath(event.orgSlug, event.slug)}
      title={t("rowTitle", { name: event.name, time })}
      className="press block truncate rounded-md border border-transparent bg-accent px-1.5 py-1 text-[11px] leading-tight text-accent-foreground hover:border-ring"
    >
      <span className="tabular-nums opacity-70">{time}</span> {event.name}
    </Link>
  );
}
