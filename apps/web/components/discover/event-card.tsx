import Link from "next/link";
import { MapPin, Video } from "lucide-react";
import type { PublicEvent } from "@ot/core/services";
import { publicEventPath } from "@/lib/urls";
import { cn, formatMoney } from "@/lib/utils";

/** "Free" when nothing is charged, otherwise the cheapest visible tier. */
export function priceLabel(event: Pick<PublicEvent, "isFree" | "minPriceMinor" | "currency">): string {
  if (event.isFree || event.minPriceMinor === null || event.minPriceMinor === 0) return "Free";
  return `from ${formatMoney(event.minPriceMinor, event.currency ?? "USD")}`;
}

export function distanceLabel(distanceKm: number | null): string | null {
  if (distanceKm === null) return null;
  return distanceKm < 1 ? "Under 1 km away" : `${Math.round(distanceKm)} km away`;
}

function whenLabel(event: Pick<PublicEvent, "startsAt" | "timezone">) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", timeZone: event.timezone }).format(event.startsAt);
}

function place(event: PublicEvent) {
  if (event.locationType === "online") return "Online";
  return event.city ?? event.venueName ?? (event.locationType === "hybrid" ? "Hybrid" : null);
}

/** The discovery card. `featured` gets a wider crop and a larger title for the top of the page. */
export function EventCard({ event, featured = false }: { event: PublicEvent; featured?: boolean }) {
  const distance = distanceLabel(event.distanceKm);
  const where = place(event);
  return (
    <Link href={publicEventPath(event.orgSlug, event.slug)} className="group block">
      <div className={cn("overflow-hidden rounded-lg border bg-muted", featured ? "aspect-[16/9]" : "aspect-[4/3]")}>
        {event.coverImageUrl && <img src={event.coverImageUrl} alt="" className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" loading="lazy" />}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        <span>{whenLabel(event)}</span>
        <span aria-hidden>·</span>
        <span className={cn(event.isFree && "text-accent-foreground")}>{priceLabel(event)}</span>
      </p>
      <h3
        className={cn("display mt-1 underline-offset-4 group-hover:underline", featured ? "text-3xl" : "text-2xl")}
        style={{ fontVariationSettings: featured ? '"opsz" 48, "SOFT" 60' : '"opsz" 32, "SOFT" 50' }}
      >
        {event.name}
      </h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
        {event.locationType === "online" ? <Video className="size-3.5 shrink-0" /> : <MapPin className="size-3.5 shrink-0" />}
        <span>{event.orgName}</span>
        {where && <span>· {where}</span>}
        {distance && <span>· {distance}</span>}
      </p>
    </Link>
  );
}

/** Compact row used inside calendar cells, where there is no room for a cover image. */
export function EventRow({ event }: { event: PublicEvent }) {
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: event.timezone }).format(event.startsAt);
  return (
    <Link
      href={publicEventPath(event.orgSlug, event.slug)}
      title={`${event.name} — ${time}`}
      className="block truncate rounded border border-transparent bg-accent px-1.5 py-0.5 text-[11px] leading-tight text-accent-foreground hover:border-ring"
    >
      <span className="tabular-nums opacity-70">{time}</span> {event.name}
    </Link>
  );
}
