import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(minor: number, currency: string, locale = "en-US") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 100);
}

export function formatDateRange(start: Date, end: Date, tz: string, locale = "en-US") {
  const day = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", timeZone: tz });
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: tz });
  const sameDay = day.format(start) === day.format(end);
  return sameDay
    ? `${day.format(start)}, ${time.format(start)} to ${time.format(end)}`
    : `${day.format(start)}, ${time.format(start)} to ${day.format(end)}, ${time.format(end)}`;
}
