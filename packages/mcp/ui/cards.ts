import { App } from "@modelcontextprotocol/ext-apps";
import { negotiateLocale, dirFor } from "../../../apps/web/i18n/locales.js";
import type { z } from "zod";
import type { cardSchema } from "../src/public-server.js";

type Card = z.infer<typeof cardSchema>;
type Messages = { title: string; loading: string; empty: string; error: string; open: string; free: string; from: string; unknown: string; format: Record<string, string> };
declare const CATALOGUES: Record<string, Messages>;
declare const INSTANCE_ORIGIN: string;
const app = new App({ name: "Evnelo public event cards", version: "1.0.0" }, {});
const cards = document.querySelector<HTMLElement>("#cards")!;
const status = document.querySelector<HTMLElement>("#status")!;
const title = document.querySelector<HTMLElement>("h1")!;
let locale = "en";
let messages = CATALOGUES.en!;
let latest: { structuredContent?: unknown; isError?: boolean } | undefined;
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text: string) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}
function problem() {
  cards.replaceChildren();
  status.setAttribute("role", "alert");
  status.textContent = messages.error;
}
function canonicalUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.origin !== INSTANCE_ORIGIN || url.username || url.password || url.search || url.hash || !/^\/[^/]+\/[^/]+$/.test(url.pathname)) return;
    return url.href;
  } catch { return; }
}
function render() {
  title.textContent = messages.title;
  cards.replaceChildren();
  status.setAttribute("role", "status");
  if (!latest) { status.textContent = messages.loading; return; }
  if (latest.isError) return problem();
  const payload = latest.structuredContent as { events?: Card[] } | undefined;
  if (!payload || !Array.isArray(payload.events) || payload.events.length > 12) return problem();
  status.textContent = payload.events.length ? "" : messages.empty;
  try {
    for (const event of payload.events) {
      const url = canonicalUrl(event.url);
      if (!url || typeof event.name !== "string" || typeof event.orgName !== "string") throw new Error("Invalid card");
      const article = document.createElement("article");
      article.append(node("p", event.orgName), node("h2", event.name));
      const time = document.createElement("time");
      time.dateTime = event.startsAt;
      const date = new Intl.DateTimeFormat(locale, { timeZone: event.timezone, dateStyle: "medium", timeStyle: "short" });
      time.textContent = `${date.format(new Date(event.startsAt))} – ${date.format(new Date(event.endsAt))}`;
      article.append(time, node("p", event.timezone));
      article.append(node("p", [messages.format[event.locationType], event.venueName, event.city].filter(Boolean).join(" · ")));
      let price = messages.unknown;
      if (event.isFree) price = messages.free;
      else if (typeof event.minPriceMinor === "number" && event.minPriceMinor >= 0 && event.currency) {
        const formatter = new Intl.NumberFormat(locale, { style: "currency", currency: event.currency });
        const minorDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
        price = messages.from.replace("{price}", formatter.format(event.minPriceMinor / 10 ** minorDigits));
      }
      article.append(node("p", price));
      const button = node("button", messages.open);
      button.type = "button";
      button.onclick = async () => {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        try {
          const result = await app.openLink({ url }, { timeout: 10_000 });
          if (result.isError) { status.setAttribute("role", "alert"); status.textContent = messages.error; }
        } catch { status.setAttribute("role", "alert"); status.textContent = messages.error; }
        finally { button.disabled = false; button.removeAttribute("aria-busy"); }
      };
      article.append(button);
      cards.append(article);
    }
  } catch { problem(); }
}
function context(ctx: { locale?: string; theme?: string } | undefined) {
  locale = negotiateLocale(ctx?.locale ?? document.documentElement.lang);
  messages = CATALOGUES[locale] ?? CATALOGUES.en!;
  document.documentElement.lang = locale;
  document.documentElement.dir = dirFor(locale as Parameters<typeof dirFor>[0]);
  document.documentElement.dataset.theme = ctx?.theme === "dark" ? "dark" : "light";
  render();
}
app.ontoolresult = result => { latest = result; render(); };
app.ontoolcancelled = () => { latest = { isError: true }; render(); };
app.onhostcontextchanged = () => context(app.getHostContext());
render();
app.connect().then(() => context(app.getHostContext())).catch(problem);
