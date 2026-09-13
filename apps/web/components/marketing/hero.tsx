import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroScene } from "./hero-scene";
import "./hero.css";

export async function Hero() {
  const t = await getTranslations("public");
  return (
    <section className="relative overflow-x-clip">
      {/* full-bleed warm glow: on its own layer so it fades out instead of being cut by the content width.
          Kept physical (right) on purpose: it sits behind the scene, which is the one physical-layout exception. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[70vw] bg-[radial-gradient(60%_70%_at_75%_60%,rgb(255_90_60/0.10),transparent_70%)]" aria-hidden />
      <div className="hero-box mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 lg:pb-0 lg:pt-16">
        <div className="relative z-10 max-w-xl lg:w-[42%]">
          <p className="eyebrow flex items-center gap-3 tracking-[0.2em]"><span className="h-0.5 w-6 bg-pulse" aria-hidden /> {t("hero.eyebrow")}</p>
          <h1 className="display mt-5 text-[clamp(2.75rem,5vw,4.25rem)]">{t("hero.title")}</h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{t("hero.lead")}</p>
          <p className="mt-4 text-lg">
            {t.rich("hero.pricing", { b: (chunks) => <strong className="font-bold">{chunks}</strong>, br: () => <br /> })}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-7"><Link href="/login">{t("nav.host")} <ArrowRight className="size-4 rtl:-scale-x-100" /></Link></Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7"><Link href="/discover">{t("hero.explore")}</Link></Button>
          </div>
        </div>
        <HeroScene />
      </div>
    </section>
  );
}
