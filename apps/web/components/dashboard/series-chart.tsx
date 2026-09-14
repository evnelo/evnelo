import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * A series of flat SVG bars on a dotted grid, one per day or month; the analytics pages' chart.
 * The caller formats every label (peak, summary, tooltip) so the copy stays with the page's
 * translations. The viewBox is stretched to the container (`preserveAspectRatio="none"`), so
 * grid lines carry `vector-effect` and the bars are plain rects.
 */
const VIEW_W = 1000;
const VIEW_H = 100;

export type SeriesPoint = { key: string; count: number };

function labelFor(key: string, unit: "day" | "month", locale: string) {
  const d = new Date(unit === "day" ? `${key}T00:00:00Z` : `${key}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return key;
  return new Intl.DateTimeFormat(locale, unit === "day" ? { month: "short", day: "numeric", timeZone: "UTC" } : { month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

export function SeriesChart({ data, unit = "day", peak, summary, aria, tooltip, className }: {
  data: SeriesPoint[];
  unit?: "day" | "month";
  peak: string;
  summary: string;
  aria: string;
  tooltip: (label: string, count: number) => string;
  className?: string;
}) {
  const locale = useLocale();
  const max = Math.max(1, ...data.map((d) => d.count));
  const slot = VIEW_W / Math.max(data.length, 1);
  const gap = Math.min(slot * 0.34, 7);
  const width = Math.min(Math.max(slot - gap, 1), 56);
  const inset = (slot - width) / 2;
  const first = data[0];
  const last = data[data.length - 1];
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow">{peak}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{summary}</p>
      </div>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" className="mt-2 h-28 w-full" role="img" aria-label={aria}>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={0} x2={VIEW_W} y1={VIEW_H * f} y2={VIEW_H * f} stroke="var(--border)" strokeDasharray="2 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {data.map((d, i) => {
          const h = (d.count / max) * (VIEW_H - 4);
          return (
            <rect key={d.key} x={i * slot + inset} y={VIEW_H - h} width={width} height={Math.max(h, d.count > 0 ? 2 : 0)} fill="var(--primary)" opacity={i === data.length - 1 ? 1 : 0.82}>
              <title>{tooltip(labelFor(d.key, unit, locale), d.count)}</title>
            </rect>
          );
        })}
      </svg>
      <div className="hairline mt-2 flex items-center justify-between pt-2">
        <span className="eyebrow">{first ? labelFor(first.key, unit, locale) : ""}</span>
        {data.length > 1 && <span className="eyebrow">{last ? labelFor(last.key, unit, locale) : ""}</span>}
      </div>
    </div>
  );
}
