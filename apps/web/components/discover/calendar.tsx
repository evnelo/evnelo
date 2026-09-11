import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { discoverHref, groupEventsByDay, type CalendarMonth, type DiscoverFilters } from "@ot/core";
import type { PublicEvent } from "@ot/core/services";
import { EventRow } from "@/components/discover/event-card";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PER_CELL = 3;

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00.000Z`));
}

/**
 * Month grid. Events are bucketed by the day they run in their own time zone, so a listing never
 * drifts to the wrong square just because the reader is in another country.
 */
export function DiscoverCalendar({ grid, events, filters, today }: { grid: CalendarMonth; events: PublicEvent[]; filters: DiscoverFilters; today: string }) {
  const byDay = groupEventsByDay(events);
  const dayHref = (key: string) => discoverHref(filters, { view: "list", date: "custom", from: key, to: key, month: null, offset: 0 });

  return (
    <section className="mt-8">
      <header className="flex items-center justify-between gap-4">
        <h2 className="display text-3xl">{monthLabel(grid.month)}</h2>
        <nav className="flex items-center gap-1" aria-label="Change month">
          <Link href={discoverHref(filters, { month: grid.previous, offset: 0 })} aria-label={`Go to ${monthLabel(grid.previous)}`} className="inline-flex size-9 items-center justify-center rounded-md border bg-card hover:bg-muted">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={discoverHref(filters, { month: today.slice(0, 7), offset: 0 })} className="inline-flex h-9 items-center rounded-md border bg-card px-3 text-sm hover:bg-muted">Today</Link>
          <Link href={discoverHref(filters, { month: grid.next, offset: 0 })} aria-label={`Go to ${monthLabel(grid.next)}`} className="inline-flex size-9 items-center justify-center rounded-md border bg-card hover:bg-muted">
            <ChevronRight className="size-4" />
          </Link>
        </nav>
      </header>

      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
                  "min-h-24 space-y-1 border-b border-r p-1.5 sm:min-h-28",
                  index % 7 === 6 && "border-r-0",
                  index >= grid.days.length - 7 && "border-b-0",
                  !day.inMonth && "bg-muted/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                    day.key === today && "bg-primary font-medium text-primary-foreground",
                    !day.inMonth && day.key !== today && "text-muted-foreground",
                  )}>
                    {day.day}
                  </span>
                  {dayEvents.length > 0 && <span className="sr-only">{dayEvents.length} events</span>}
                </div>
                {dayEvents.slice(0, PER_CELL).map((event) => <EventRow key={`${day.key}-${event.id}`} event={event} />)}
                {overflow > 0 && (
                  <Link href={dayHref(day.key)} className="block px-1.5 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
                    +{overflow} more
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Times are shown in each event&rsquo;s own time zone.</p>
    </section>
  );
}
