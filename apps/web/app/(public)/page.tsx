import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check, CalendarDays, Code2, ScanLine, Ticket, Users } from "lucide-react";
import { listDiscoverableEvents } from "@/lib/queries/events";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/discover/event-card";
import { Hero } from "@/components/marketing/hero";

export const metadata: Metadata = {
  title: "Evnelo: events, in motion",
  description: "Open event infrastructure. Publish events, register attendees, sell or give away tickets, message your community and check people in. 0.99% on paid tickets, free events are free, or self-host for nothing.",
  alternates: { canonical: "/" },
};

export const dynamic = "force-dynamic";

const steps = [
  { icon: CalendarDays, title: "Publish", text: "An event page with your cover, schedule, venue and hosts. Public, unlisted, or private by invitation." },
  { icon: Users, title: "Register", text: "Ticket tiers, your own questions, guests with their own tickets, discount codes, a waitlist when you sell out." },
  { icon: Ticket, title: "Pay and receive", text: "Cards, Apple Pay, Google Pay, Pix. Tickets with a QR code, wallet passes, calendar files, confirmation by email and SMS." },
  { icon: ScanLine, title: "Check in", text: "A scanner that runs in any phone browser, keeps working without signal, and shows the room filling up live." },
];

const developer = [
  "REST API for every resource, with idempotent writes",
  "Generated TypeScript SDK and an MCP server for agents",
  "Signed webhooks for registrations, payments and check-ins",
  "OpenAPI document and interactive docs at /api/v1/docs",
];

export default async function HomePage() {
  const upcoming = (await listDiscoverableEvents({ limit: 3 })).filter((e) => e.coverImageUrl);
  return (
    <div className="overflow-x-clip">
      <Hero />

      {/* Pricing band */}
      <section id="pricing" className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-end">
            <div>
              <p className="eyebrow text-paper/60">Pricing</p>
              <h2 className="display mt-3 text-4xl sm:text-5xl">Lower fees than any other platform.</h2>
              <p className="mt-5 max-w-md text-paper/75">Most platforms take 3 to 5 percent plus a fee on every ticket. Evnelo takes 0.99% on paid tickets and nothing on free ones. Payment processing is Stripe&rsquo;s, at Stripe&rsquo;s rate, and you can pass the fee to buyers or absorb it.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { title: "Free events", price: "$0", note: "No platform fee, no per-ticket fee, unlimited attendees." },
                { title: "Paid events", price: "0.99%", note: "On the ticket price. A $25 ticket costs you 25 cents, plus Stripe." , accent: true },
                { title: "Self-hosted", price: "$0", note: "Open source. One container, your MySQL, your Stripe keys. No platform fee ever." },
              ].map((p) => (
                <div key={p.title} className={p.accent ? "rounded-lg bg-pulse p-6 text-white" : "rounded-lg border border-paper/15 p-6"}>
                  <p className={p.accent ? "text-sm font-medium text-white/80" : "text-sm font-medium text-paper/60"}>{p.title}</p>
                  <p className="display mt-3 text-5xl">{p.price}</p>
                  <p className={p.accent ? "mt-3 text-sm text-white/85" : "mt-3 text-sm text-paper/70"}>{p.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it flows */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <p className="eyebrow">How it flows</p>
        <h2 className="display mt-3 max-w-2xl text-4xl sm:text-5xl">Everything between “I want to go” and “I&rsquo;m here”.</h2>
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="animate-rise rounded-lg border bg-card p-6" style={{ "--stagger": i } as React.CSSProperties}>
              <div className="flex size-11 items-center justify-center rounded-md bg-accent text-accent-foreground"><Icon className="size-5" /></div>
              <p className="mt-5 text-lg font-semibold">{title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Open source + developers */}
      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="eyebrow">Open source</p>
            <h2 className="display mt-3 text-4xl">Your events. Your data. Your stack.</h2>
            <p className="mt-5 text-muted-foreground">Evnelo is open source. Host it yourself with one container and one MySQL database, plug in your own Stripe, Resend and Vonage keys, and keep every attendee record on your own infrastructure. Same product, no platform fee.</p>
            <ul className="mt-6 space-y-2 text-sm">
              {["Attendee export and erasure built in", "Bring your own payment, email and SMS providers", "Migrations, health checks and backups documented", "Moving to or from the hosted edition is a database, not a rewrite"].map((t) => (
                <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-pulse" /> {t}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="dark"><a href="https://github.com/evnelo/evnelo" rel="noopener noreferrer">View the source</a></Button>
              <Button asChild variant="outline"><a href="/api/v1/docs">API reference</a></Button>
            </div>
          </div>
          <div>
            <p className="eyebrow">For developers</p>
            <h2 className="display mt-3 text-4xl">Built to be built on.</h2>
            <ul className="mt-6 space-y-2 text-sm">
              {developer.map((t) => <li key={t} className="flex items-start gap-2"><Code2 className="mt-0.5 size-4 shrink-0 text-pulse" /> {t}</li>)}
            </ul>
            <pre className="code-panel mt-8 overflow-x-auto p-5"><code>{`import { createEvneloClient } from "@ot/sdk";

const evnelo = createEvneloClient({
  baseUrl: "https://evnelo.com",
  apiKey: process.env.EVNELO_API_KEY,
});

const { data } = await evnelo.GET("/api/v1/events");`}</code></pre>
          </div>
        </div>
      </section>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Happening soon</p>
              <h2 className="display mt-3 text-4xl">Public events on Evnelo</h2>
            </div>
            <Link href="/discover" className="press inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">All events <ArrowRight className="size-4" /></Link>
          </div>
          <ul className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e, i) => <li key={e.id} className="animate-rise" style={{ "--stagger": i } as React.CSSProperties}><EventCard event={e} /></li>)}
          </ul>
        </section>
      )}

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="rounded-xl bg-pulse px-6 py-12 text-white sm:px-12 sm:py-16">
          <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="display text-4xl sm:text-5xl">Make gathering flow.</h2>
              <p className="mt-3 max-w-lg text-white/85">Create your first event in a few minutes. No card needed for free events.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="dark"><Link href="/login">Host an event</Link></Button>
              <Button asChild size="lg" className="bg-white text-ink hover:bg-white/90"><Link href="/discover">See what&rsquo;s on</Link></Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
