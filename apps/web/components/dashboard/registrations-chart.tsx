import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Registrations per day as flat SVG bars on a dotted grid. The viewBox is stretched to the
 * container (`preserveAspectRatio="none"`), so nothing here may use a stroke that must keep its
 * width — grid lines carry `vector-effect` and the bars are plain rects.
 */

const VIEW_W = 1000;
const VIEW_H = 100;

const label = (day: string, locale: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? day : new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
};

export function RegistrationsChart({ data, className }: { data: { day: string; count: number }[]; className?: string }) {
  const t = useTranslations("manage");
  const locale = useLocale();
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((a, d) => a + d.count, 0);
  const slot = VIEW_W / data.length;
  const gap = Math.min(slot * 0.34, 7);
  // a two-day event must not draw two half-page slabs, so bars are capped and centred in their slot
  const width = Math.min(Math.max(slot - gap, 1), 56);
  const inset = (slot - width) / 2;
  const first = data[0];
  const last = data[data.length - 1];

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow">{t("chart.peak", { max })}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{t("chart.summary", { total, days: data.length })}</p>
      </div>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" className="mt-2 h-28 w-full" role="img" aria-label={t("chart.aria", { max, total })}>
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={VIEW_W}
            y1={VIEW_H * f}
            y2={VIEW_H * f}
            stroke="var(--border)"
            strokeDasharray="2 4"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {data.map((d, i) => {
          const h = (d.count / max) * (VIEW_H - 4);
          return (
            <rect
              key={d.day}
              x={i * slot + inset}
              y={VIEW_H - h}
              width={width}
              height={Math.max(h, d.count > 0 ? 2 : 0)}
              fill="var(--primary)"
              opacity={i === data.length - 1 ? 1 : 0.82}
            >
              <title>{t("chart.tooltip", { date: label(d.day, locale), count: d.count })}</title>
            </rect>
          );
        })}
      </svg>
      <div className="hairline mt-2 flex items-center justify-between pt-2">
        <span className="eyebrow">{first ? label(first.day, locale) : ""}</span>
        {data.length > 1 && <span className="eyebrow">{last ? label(last.day, locale) : ""}</span>}
      </div>
    </div>
  );
}
