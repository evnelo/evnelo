"use client";

import { useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { computeOrder } from "@evnelo/core";
import { feePerTicket, LUMA_PLUS_MONTHLY_MINOR, type FeePlatform } from "@/lib/competitor-fees";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { PopNumber } from "@/components/pop-number";
import { cn } from "@/lib/utils";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "BRL"] as const;
const PRESETS: Record<string, number[]> = { BRL: [30, 50, 100, 200] };
const DEFAULT_PRESETS = [10, 25, 50, 100];
const MAX_PRICE = 100_000;
const MAX_QUANTITY = 1_000_000;

/** "25", "25.5" or "25,50" to minor units; anything unreadable counts as zero so the numbers never show NaN. */
function toMinor(value: string): number {
  const n = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(Math.min(n, MAX_PRICE) * 100) : 0;
}

function toQuantity(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_QUANTITY) : 0;
}

function useMoney(currency: string) {
  const locale = useLocale();
  return useMemo(() => {
    const format = new Intl.NumberFormat(locale, { style: "currency", currency });
    const symbol = format.formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
    return { format: (minor: number) => format.format(minor / 100), symbol };
  }, [locale, currency]);
}

/** Price and quantity, plus one-tap common prices. The price field carries the currency symbol inside it. */
function Inputs({ price, setPrice, quantity, setQuantity, currency, children }: {
  price: string; setPrice: (v: string) => void; quantity: string; setQuantity: (v: string) => void; currency: string; children?: React.ReactNode;
}) {
  const t = useTranslations("public.calculator");
  const money = useMoney(currency);
  const id = useId();
  const presets = PRESETS[currency] ?? DEFAULT_PRESETS;
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-price`}>{t("price")}</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm text-muted-foreground">{money.symbol}</span>
            <Input id={`${id}-price`} inputMode="decimal" autoComplete="off" value={price} onChange={(e) => setPrice(e.target.value)} className="h-12 ps-11 text-lg font-semibold tabular-nums" />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-qty`}>{t("quantity")}</Label>
          <Input id={`${id}-qty`} inputMode="numeric" autoComplete="off" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} className="h-12 text-lg font-semibold tabular-nums" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("presets")}>
        {presets.map((p) => {
          const active = toMinor(price) === p * 100;
          return (
            <button key={p} type="button" aria-pressed={active} onClick={() => setPrice(String(p))}
              className={cn("press h-8 rounded-full border px-3 text-sm tabular-nums", active ? "border-ink bg-ink text-paper" : "border-border hover:bg-muted/80")}>
              {money.format(p * 100).replace(/[.,]00$/, "")}
            </button>
          );
        })}
        {children}
      </div>
    </div>
  );
}

/**
 * Platform fees side by side for one ticket price and volume, drawn to one scale: each bar is that
 * platform's total fee against the largest one. Evnelo is first and the only bar in Pulse.
 */
export function FeeComparison({ platforms, currency, defaultPrice, defaultQuantity = 200 }: {
  platforms: FeePlatform[]; currency: string; defaultPrice: number; defaultQuantity?: number;
}) {
  const t = useTranslations("public.calculator");
  const money = useMoney(currency);
  const [price, setPrice] = useState(String(defaultPrice));
  const [quantity, setQuantity] = useState(String(defaultQuantity));
  const priceMinor = toMinor(price);
  const count = toQuantity(quantity);

  const rows = platforms.map((platform) => {
    const each = feePerTicket(platform, priceMinor);
    return { platform, each, total: each * count };
  });
  const max = Math.max(...rows.map((r) => r.total), 0);
  const evnelo = rows.find((r) => r.platform === "evnelo");
  const costliest = rows.filter((r) => r.platform !== "evnelo").sort((a, b) => b.total - a.total)[0];
  const saving = evnelo && costliest ? costliest.total - evnelo.total : 0;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-card sm:p-8">
      <Inputs price={price} setPrice={setPrice} quantity={quantity} setQuantity={setQuantity} currency={currency} />
      <ul className="mt-8 grid gap-6" aria-label={t("chartLabel", { count })}>
        {rows.map((r) => (
          <li key={r.platform} className="grid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className={cn("font-semibold", r.platform === "evnelo" && "text-lg")}>{t(`platforms.${r.platform}`)}</span>
              <span className="text-lg font-semibold tabular-nums">
                {money.format(r.total)}
                {r.platform === "lumaPlus" && <span className="ms-1.5 text-base">{t("plusPerMonth", { amount: money.format(LUMA_PLUS_MONTHLY_MINOR) })}</span>}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className={cn("h-full rounded-full transition-[width] duration-(--duration-medium) ease-smooth-out", r.platform === "evnelo" ? "bg-pulse" : "bg-ink/80")}
                style={{ width: max > 0 ? `${Math.max((r.total / max) * 100, r.total > 0 ? 1.5 : 0)}%` : "0%" }}
              />
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {t("perTicket", { amount: money.format(r.each) })} · {t("onTickets", { count })}
              {r.platform === "lumaPlus" && <> · {t("plusMonthly")}</>}
            </p>
          </li>
        ))}
      </ul>
      {costliest && saving > 0 && (
        <p className="mt-8 border-t pt-6 text-xl font-semibold leading-snug sm:text-2xl" aria-live="polite">
          {t.rich("keepMore", {
            amount: money.format(saving),
            platform: t(`platforms.${costliest.platform}`),
            em: (chunks) => <PopNumber value={String(chunks)} className="text-pulse" />,
          })}
        </p>
      )}
    </div>
  );
}

const defaultCurrency = (locale: string) => (locale === "pt-BR" ? "BRL" : ["de", "fr", "it"].includes(locale) ? "EUR" : "USD");

/** Evnelo alone: what the buyer pays and what the host receives, with the fee absorbed or passed on. Same math as checkout (`computeOrder`). */
export function PricingCalculator() {
  const t = useTranslations("public.calculator");
  const locale = useLocale();
  const id = useId();
  const [currency, setCurrency] = useState<string>(() => defaultCurrency(locale));
  const [price, setPrice] = useState(currency === "BRL" ? "50" : "25");
  const [quantity, setQuantity] = useState("200");
  const [mode, setMode] = useState<"absorb" | "passOn">("absorb");
  const money = useMoney(currency);
  const priceMinor = toMinor(price);
  const count = toQuantity(quantity);
  // one ticket per order, the common case: the fee rounds per ticket, as it does at checkout
  const one = computeOrder([{ unitPriceMinor: priceMinor, quantity: 1 }], { edition: "cloud", feePassThrough: mode === "passOn" });

  const tiles = [
    { key: "buyerPays", value: money.format(one.totalMinor), note: t("perTicket", { amount: money.format(one.totalMinor) }) },
    { key: "evneloFee", value: money.format(one.platformFeeMinor * count), note: t("onTickets", { count }) },
    { key: "youReceive", value: money.format(one.organizerNetMinor * count), note: t("onTickets", { count }) },
  ] as const;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-card sm:p-8">
      <Inputs price={price} setPrice={setPrice} quantity={quantity} setQuantity={setQuantity} currency={currency}>
        <div className="ms-auto flex items-center gap-2">
          <Label htmlFor={`${id}-currency`} className="text-muted-foreground">{t("currency")}</Label>
          <Select id={`${id}-currency`} value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-8 w-24">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </Inputs>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{t("whoPays")}</span>
        <Segmented label={t("whoPays")} value={mode} onChange={setMode} options={[{ value: "absorb", label: t("absorb") }, { value: "passOn", label: t("passOn") }]} />
      </div>
      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.key} className={cn("grid content-start gap-1 rounded-lg p-5", tile.key === "youReceive" ? "bg-ink text-paper" : "bg-muted/60")}>
            <dt className={cn("text-sm font-medium", tile.key === "youReceive" ? "text-paper/70" : "text-muted-foreground")}>{t(tile.key)}</dt>
            <dd className="display text-3xl tabular-nums"><PopNumber value={tile.value} /></dd>
            {tile.key !== "buyerPays" && <dd className={cn("text-sm", tile.key === "youReceive" ? "text-paper/70" : "text-muted-foreground")}>{tile.note}</dd>}
          </div>
        ))}
      </dl>
      <p className="mt-5 text-sm text-muted-foreground">{t("beforeStripe")}</p>
    </div>
  );
}
