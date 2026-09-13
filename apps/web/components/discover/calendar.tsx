import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { discoverHref, groupEventsByDay, type CalendarMonth, type DiscoverFilters } from "@evnelo/core";
import type { PublicEvent } from "@evnelo/core/services";
import { EventRow } from "@/components/discover/event-card";
import { cn } from "@/lib/utils";

const PER_CELL = 3;
/** 2023-01-01 was a Sunday; the grid starts its weeks there. */
const SUNDAY = Date.UTC(2023, 0, 1);

const navButton = "press inline-flex h-11 items-center justify-center rounded-full border border-border/80 bg-card text-sm hover:bg-muted";

/**
 * Month grid. Events are bucketed by the day they run in their own time zone, so a listing never
 * drifts to the wrong square just because the reader is in another country.
 */
export function DiscoverCalendar({ grid, events, filters, today }: { grid: CalendarMonth; events: PublicEvent[]; filters: DiscoverFilters; today: string }) {
  const t = useTranslations("public.discover.calendar");
  const locale = useLocale();
  const byDay = groupEventsByDay(events);
  const dayHref = (key: string) => discoverHref(filters, { view: "list", date: "custom", from: key, to: key, month: null, offset: 0 });
  const monthLabel = (month: string) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00.000Z`));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const weekdays = Array.from({ length: 7 }, (_, i) => weekday.format(new Date(SUNDAY + i * 86_400_000)));

  return (
    <section className="animate-rise mt-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2 className="display mt-1 text-3xl sm:text-4xl">{monthLabel(grid.month)}</h2>
        </div>
        <nav className="flex items-center gap-1.5" aria-label={t("changeMonth")}>
          <Link href={discoverHref(filters, { month: grid.previous, offset: 0 })} aria-label={t("goTo", { month: monthLabel(grid.previous) })} className={cn(navButton, "w-11")}>
            <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          </Link>
          <Link href={discoverHref(filters, { month: today.slice(0, 7), offset: 0 })} className={cn(navButton, "px-4 font-medium")}>{t("today")}</Link>
          <Link href={discoverHref(filters, { month: grid.next, offset: 0 })} aria-label={t("goTo", { month: monthLabel(grid.next) })} className={cn(navButton, "w-11")}>
            <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden />
          </Link>
        </nav>
      </header>

      <div className="mt-6 overflow-hidden rounded-xl border border-border/80 bg-card shadow-card">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {weekdays.map((day) => (
            <div key={day} className="eyebrow px-2 py-2 text-center">
              <span aria-hidden>{day.slice(0, 1)}</span>
              <span className="sr-only">{day}</span>
              <span className="hidden sm:inline" aria-hidden>{day.slice(1)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.days.map((day, index) => {
            const dayEvents = byDay.get(day.key) ?? [];
            const overflow = dayEvents.length - PER_CELL;
            return (
              <div
                key={day.key}
                className={cn(
                  "min-h-24 space-y-1 border-b border-e border-border/70 p-1.5 sm:min-h-28",
                  index % 7 === 6 && "border-e-0",
                  index >= grid.days.length - 7 && "border-b-0",
                  !day.inMonth && "bg-muted/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-full font-display text-sm tabular-nums",
                      day.key === today && "bg-primary text-primary-foreground",
                      !day.inMonth && day.key !== today && "text-muted-foreground/70",
                    )}
                  >
                    {day.day}
                  </span>
                  {dayEvents.length > 0 && <span className="sr-only">{t("dayCount", { count: dayEvents.length })}</span>}
                </div>
                {dayEvents.slice(0, PER_CELL).map((event) => <EventRow key={`${day.key}-${event.id}`} event={event} />)}
                {overflow > 0 && (
                  <Link href={dayHref(day.key)} className="block px-1.5 py-0.5 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
                    {t("overflow", { count: overflow })}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("timezoneNote")}</p>
    </section>
  );
}
