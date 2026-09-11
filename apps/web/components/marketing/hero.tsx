import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroScene } from "./hero-scene";

export function Hero() {
  return (
    <section className="relative mx-auto max-w-7xl overflow-hidden px-4 pb-10 pt-12 sm:px-6 lg:pb-20 lg:pt-20">
      <div className="pointer-events-none absolute -right-40 top-40 size-[36rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_90_60/0.08),transparent)]" aria-hidden />
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-10">
        <div className="max-w-xl">
          <p className="eyebrow flex items-center gap-3 tracking-[0.2em]"><span className="h-0.5 w-6 bg-pulse" aria-hidden /> Open event infrastructure</p>
          <h1 className="display mt-5 text-[clamp(2.75rem,5.4vw,4.6rem)]">From first click to front gate.</h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">Publish events, sell tickets, message attendees, and run check-in in one open platform, or self-host it on your own stack.</p>
          <p className="mt-4 text-lg"><strong className="font-bold">0.99%</strong> on paid tickets. Free events stay free.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-7"><Link href="/login">Host an event <ArrowRight className="size-4" /></Link></Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7"><Link href="/discover">Explore events</Link></Button>
          </div>
        </div>
        <HeroScene />
      </div>
    </section>
  );
}
