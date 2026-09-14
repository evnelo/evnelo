import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** Three steps, each bar scaled to the first; the copy under each is count and share. */
export function Funnel({ steps }: { steps: { label: string; count: number }[] }) {
  const base = steps[0]?.count ?? 0;
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.label} className="animate-rise" style={{ ["--stagger" as string]: i }}>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className={cn("h-full rounded-full", i === 0 ? "bg-foreground/70" : "bg-primary")} style={{ width: `${base ? Math.max((s.count / base) * 100, s.count ? 2 : 0) : 0}%` }} />
          </div>
          <p className="mt-2 font-display text-2xl tabular-nums">{s.count.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{s.label}{i > 0 && base > 0 ? ` · ${pct(s.count, base)}%` : ""}</p>
        </li>
      ))}
    </ol>
  );
}

/** A quiet two- or three-column table for the breakdown lists (sources, campaigns, countries). */
export function BreakdownTable({ rows, columns, empty }: { rows: (string | number)[][]; columns: string[]; empty: string }) {
  if (!rows.length) return <p className="mt-3 text-sm text-muted-foreground">{empty}</p>;
  return (
    <table className="mt-3 w-full text-sm">
      <thead>
        <tr className="text-start text-xs text-muted-foreground">
          {columns.map((c, i) => <th key={c} scope="col" className={cn("pb-2 font-medium", i === 0 ? "text-start" : "text-end")}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border/70">
            {r.map((cell, j) => <td key={j} className={cn("py-2", j === 0 ? "truncate pe-3" : "text-end tabular-nums")}>{typeof cell === "number" ? cell.toLocaleString() : cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Email delivery, opens and clicks with their rates over what was sent. */
export async function EmailHealth({ email }: { email: { sent: number; delivered: number; bounced: number; failed: number; opened: number; clicked: number } }) {
  const t = await getTranslations("dashboard.analytics.email");
  // rates are over everything that left the queue, so a failed send counts against delivery too
  const base = email.sent + email.failed;
  const items = [
    { label: t("sent"), value: base, rate: null },
    { label: t("delivered"), value: email.delivered, rate: pct(email.delivered, base) },
    { label: t("opened"), value: email.opened, rate: pct(email.opened, base) },
    { label: t("clicked"), value: email.clicked, rate: pct(email.clicked, base) },
    { label: t("bounced"), value: email.bounced + email.failed, rate: pct(email.bounced + email.failed, base) },
  ];
  return (
    <Card className="p-5">
      <p className="eyebrow">{t("title")}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
        {items.map((i) => (
          <div key={i.label}>
            <dt className="text-xs text-muted-foreground">{i.label}</dt>
            <dd className="mt-0.5 font-display text-xl tabular-nums">{i.value.toLocaleString()}{i.rate !== null && base > 0 && <span className="ms-1.5 text-xs font-normal text-muted-foreground">{i.rate}%</span>}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{t("hint")}</p>
    </Card>
  );
}
