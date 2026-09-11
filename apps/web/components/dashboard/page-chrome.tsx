import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The shared furniture every dashboard surface is built from: page header, section card,
 * toolbar, stat, date leaf and empty state. Purely presentational — no data, no actions —
 * so it works the same in a server page and inside a client panel.
 */

/** Title in the display serif, one line of description, primary action on the right. */
export function PageHeader({ title, description, actions, above, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; above?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0 flex-1 basis-64">
        {above}
        <h1 className="display truncate text-3xl">{title}</h1>
        {description && <div className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A settings/form section: heading and description on the left, fields on the right from md up. */
export function SectionCard({ title, description, aside, children, className }: { title: React.ReactNode; description?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border/80 bg-card text-card-foreground shadow-card", className)}>
      <div className="grid gap-x-10 gap-y-5 p-5 sm:p-6 md:grid-cols-[13.5rem_minmax(0,1fr)]">
        <div className="md:pt-px">
          <h2 className="text-sm font-medium">{title}</h2>
          {description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>}
          {aside && <div className="mt-3">{aside}</div>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

/** Filters on the left, actions on the right. Wraps to two rows on a phone. */
export function Toolbar({ children, actions, className }: { children?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">{children}</div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Big serif number over an eyebrow label. */
export function Stat({ label, value, sub, className }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 truncate font-display text-3xl tabular-nums leading-none" style={{ fontVariationSettings: '"opsz" 48, "SOFT" 40' }}>{value}</p>
      {sub && <p className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function StatCard({ label, value, sub, className }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/80 bg-card p-4 shadow-card sm:p-5", className)}>
      <Stat label={label} value={value} sub={sub} />
    </div>
  );
}

/** A smaller stat for table-like rows: eyebrow over a tabular number. */
export function Metric({ label, value, sub, className }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="eyebrow">{label}</p>
      <p className="mt-0.5 truncate font-display text-lg tabular-nums leading-tight" style={{ fontVariationSettings: '"opsz" 32, "SOFT" 40' }}>{value}</p>
      {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Month over day, like a tear-off desk calendar. Rendered in the event's own time zone. */
export function DateLeaf({ date, timezone, className }: { date: Date; timezone: string; className?: string }) {
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: timezone }).format(date).toUpperCase();
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: timezone }).format(date);
  return (
    <div className={cn("date-leaf", className)} aria-hidden>
      <span>{month}</span>
      <span>{day}</span>
    </div>
  );
}

/** Icon in a soft circle, one sentence, one action. Never a bare "No results". */
export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center", className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-6" strokeWidth={1.5} />
      </span>
      <p className="mt-4 font-display text-xl" style={{ fontVariationSettings: '"opsz" 36' }}>{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** The same empty state, sized and centred for the inside of a table body. */
export function EmptyCell({ icon: Icon, title, description, action }: { icon: LucideIcon; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-5" strokeWidth={1.5} />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** A quiet explanatory note above a panel — the "how this works" paragraph. */
export function Note({ children, tone = "muted", className }: { children: React.ReactNode; tone?: "muted" | "warning"; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-relaxed",
        tone === "warning" ? "border-[#e6d39a] bg-[#fbf1d6] text-[#5a4300]" : "border-border/70 bg-muted/50 text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
