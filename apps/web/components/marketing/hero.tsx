import Link from "next/link";
import { ArrowRight, BarChart3, CalendarDays, Check, Heart, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./hero.css";

const COVER = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&q=70";
const AVATARS = [32, 47, 5];

function Sparkle({ color, className, style }: { color: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={`hero-sparkle ${className ?? ""}`} style={style} aria-hidden>
      <g stroke={color}><line x1="12" y1="3" x2="12" y2="9" /><line x1="4" y1="7" x2="8.5" y2="11" /><line x1="20" y1="7" x2="15.5" y2="11" /></g>
    </svg>
  );
}

function FakeQr() {
  // a decorative grid, not a real code
  const cells = "1101011 1000101 1011101 0110010 1011101 1000101 1101011".split(" ");
  return (
    <div className="grid grid-cols-7 gap-[0.18cqw]" aria-hidden>
      {cells.flatMap((row, y) => row.split("").map((c, x) => <span key={`${x}${y}`} className={c === "1" ? "aspect-square bg-ink" : "aspect-square"} />))}
    </div>
  );
}

/** The hero scene: a gradient flow line through five stops with the product shown as small cards. Pure HTML/CSS plus two photos. */
export function HeroScene() {
  return (
    <div className="hero-scene" aria-hidden>
      <svg viewBox="0 0 1000 690" className="inset-0 size-full" fill="none">
        <defs>
          <linearGradient id="hero-flow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--evnelo-pulse)" /><stop offset="0.3" stopColor="var(--evnelo-lime)" /><stop offset="0.55" stopColor="var(--evnelo-sky)" /><stop offset="0.8" stopColor="#F5B342" /><stop offset="1" stopColor="var(--evnelo-pulse)" />
          </linearGradient>
        </defs>
        <path d="M 40 640 C 200 640, 330 470, 490 430 S 600 450, 660 440 S 770 380, 820 270 S 900 215, 955 215" stroke="url(#hero-flow)" strokeWidth="22" strokeLinecap="round" opacity="0.9" />
        {[[40, 640, "var(--evnelo-pulse)"], [490, 430, "var(--evnelo-lime)"], [660, 440, "var(--evnelo-sky)"], [820, 270, "#F5B342"], [955, 215, "var(--evnelo-pulse)"]].map(([x, y, c]) => (
          <circle key={String(x)} cx={x as number} cy={y as number} r="15" fill={c as string} stroke="var(--evnelo-white)" strokeWidth="5" />
        ))}
      </svg>

      {/* stop labels */}
      <div style={{ left: "6%", top: "94.5%" }}><p className="hero-label">Discover</p><p className="hero-sub">Find what moves you</p></div>
      <div style={{ left: "48%", top: "67.5%" }}><p className="hero-label">Register</p><p className="hero-sub">A few clicks away</p></div>
      <div style={{ left: "64%", top: "68.5%" }}><p className="hero-label">Ticketing</p><p className="hero-sub">Sell with no limits</p></div>
      <div style={{ left: "82%", top: "43.5%" }}><p className="hero-label">Check-in</p><p className="hero-sub">Fast. Friendly. Flexible.</p></div>
      <div style={{ left: "90%", top: "33%", width: "12%" }}><p className="hero-label">Attendance</p><p className="hero-sub">Real people. Lasting impact.</p></div>

      {/* event card */}
      <div className="hero-card hero-float" style={{ left: "19%", top: "57%", width: "27%", rotate: "-7deg" }}>
        <div className="relative aspect-[16/9] bg-muted">
          <img src={COVER} alt="" className="size-full object-cover" loading="lazy" />
          <span className="absolute right-[5%] top-[10%] flex size-[3.4cqw] items-center justify-center rounded-full bg-white text-ink"><Heart className="size-[1.7cqw]" /></span>
        </div>
        <div className="p-[1.4cqw]">
          <p className="eyebrow text-[1cqw]">Music</p>
          <p className="mt-[0.2cqw] text-[1.9cqw] font-bold leading-tight tracking-tight">Sunset Sessions</p>
          <p className="mt-[0.5cqw] flex items-center gap-[0.7cqw] text-[1.15cqw] text-muted-foreground"><CalendarDays className="size-[1.2cqw]" /> Sat, Aug 24, 2024 <MapPin className="ml-[0.4cqw] size-[1.2cqw]" /> Riverside Park</p>
        </div>
      </div>
      <Sparkle color="var(--evnelo-pulse)" style={{ left: "14%", top: "62%", rotate: "-40deg" }} />

      {/* create event card */}
      <div className="hero-card hero-float p-[1.6cqw]" style={{ left: "43%", top: "36%", width: "19%", rotate: "5deg" }}>
        <p className="text-[1.5cqw] font-semibold">Create your event</p>
        <div className="mt-[1cqw] h-[0.9cqw] w-[80%] rounded-full bg-mist" />
        <div className="mt-[0.7cqw] h-[0.9cqw] w-[55%] rounded-full bg-mist" />
        <div className="mt-[1.4cqw] inline-flex items-center rounded-[0.9cqw] bg-ink px-[1.4cqw] py-[0.7cqw] text-[1.15cqw] font-semibold text-paper">Publish event</div>
      </div>
      <Sparkle color="var(--evnelo-lime)" style={{ left: "61%", top: "30%", rotate: "20deg" }} />

      {/* ticket */}
      <div className="hero-card hero-ticket hero-float flex" style={{ left: "55%", top: "46%", width: "25%", rotate: "-3deg" }}>
        <div className="flex-1 p-[1.5cqw]">
          <p className="text-[1.05cqw] font-semibold text-pulse">Evnelo</p>
          <p className="mt-[0.4cqw] whitespace-nowrap text-[1.55cqw] font-bold leading-tight tracking-tight">General Admission</p>
          <p className="mt-[0.5cqw] text-[1.05cqw] text-muted-foreground">Sat, Aug 24, 2024<br />Riverside Park</p>
        </div>
        <div className="flex w-[34%] items-center justify-center border-l-[0.2cqw] border-dashed border-mist p-[1.2cqw]"><FakeQr /></div>
      </div>
      <Sparkle color="var(--evnelo-sky)" style={{ left: "68%", top: "42%", rotate: "10deg" }} />

      {/* check-in card */}
      <div className="hero-card hero-float p-[1.6cqw] text-center" style={{ left: "72%", top: "15%", width: "17%", rotate: "3deg" }}>
        <span className="mx-auto flex size-[3.6cqw] items-center justify-center rounded-full bg-lime text-ink"><Check className="size-[2cqw]" strokeWidth={3} /></span>
        <p className="mt-[1cqw] whitespace-nowrap text-[1.25cqw] font-semibold">Attendee checked in</p>
        <p className="text-[1.05cqw] text-muted-foreground">Welcome!</p>
      </div>
      <Sparkle color="var(--evnelo-pulse)" style={{ left: "70%", top: "27%", rotate: "-60deg" }} />

      {/* attendance stat + avatars */}
      <div className="hero-card hero-float flex items-end justify-between p-[1.5cqw]" style={{ left: "86%", top: "20%", width: "14%", rotate: "-3deg" }}>
        <div><p className="text-[2.6cqw] font-bold leading-none tracking-tight">1,024</p><p className="mt-[0.4cqw] text-[1.05cqw] text-muted-foreground">people attended</p></div>
        <BarChart3 className="size-[3cqw] text-pulse" />
      </div>
      <div className="flex items-center" style={{ left: "86.5%", top: "10%" }}>
        {AVATARS.map((n, i) => <img key={n} src={`https://i.pravatar.cc/80?img=${n}`} alt="" className="size-[4.2cqw] rounded-full border-[0.3cqw] border-white object-cover" style={{ marginLeft: i ? "-1.2cqw" : 0 }} loading="lazy" />)}
        <span className="ml-[-1.2cqw] flex size-[4.2cqw] items-center justify-center rounded-full border-[0.3cqw] border-white bg-mist text-[1.1cqw] font-semibold">+832</span>
      </div>
      <Sparkle color="var(--evnelo-pulse)" style={{ left: "97%", top: "4%", rotate: "40deg" }} />

      {/* handwritten notes */}
      <p className="hero-note" style={{ left: "0%", top: "83%", rotate: "-6deg" }}>More events.<br />A more open world.</p>
      <p className="hero-note text-right" style={{ right: "0%", top: "82%", rotate: "-6deg" }}>Events<br />move people.</p>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative mx-auto max-w-7xl overflow-hidden px-4 pb-10 pt-12 sm:px-6 lg:pb-20 lg:pt-20">
      <div className="pointer-events-none absolute -right-40 top-40 size-[36rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_90_60/0.08),transparent)]" aria-hidden />
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,4.2fr)_minmax(0,7.8fr)] lg:gap-6">
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
