import type { Money, MoneyByCurrency } from "@evnelo/core/services";
import { formatMoney } from "@/lib/utils";

/**
 * One field of a per-currency total as text, currencies joined with " + ". A currency with paid orders shows
 * even at zero (a fully refunded event reads $0.00, not "never sold"); `empty` only when nothing was sold.
 */
export function moneyText(money: MoneyByCurrency, field: keyof Omit<Money, "paidOrders">, locale: string, empty: string) {
  const parts = Object.entries(money).filter(([, m]) => m.paidOrders > 0).sort(([a], [b]) => a.localeCompare(b)).map(([currency, m]) => formatMoney(m[field], currency, locale));
  return parts.length ? parts.join(" + ") : empty;
}

export const paidOrders = (money: MoneyByCurrency) => Object.values(money).reduce((a, m) => a + m.paidOrders, 0);

export const shortDate = (date: Date, locale: string, timeZone = "UTC") => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(date);
