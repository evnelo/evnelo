"use client";

import { motion, useReducedMotion } from "motion/react";
import { BarChart3, CalendarDays, Check, Heart, MapPin } from "lucide-react";

const COVER = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&q=70";
const AVATARS = [32, 47, 5];

/**
 * Coordinates are % of the whole hero (viewBox 1000×560, roughly 16:9). The line starts under the
 * copy at the bottom left and climbs to the top right; cards sit on it, labels hang off the nodes.
 */
/** viewBox 1000×562 matches the hero's 16:9 box, so 1 unit = 0.1% horizontally and 0.178% vertically. */
const VB = { w: 1000, h: 562 };
const NODES = [
  { x: 210, y: 502, color: "var(--evnelo-pulse)", label: "Discover", sub: "Find what moves you", delay: 0.15 },
  { x: 490, y: 351, color: "var(--evnelo-lime)", label: "Register", sub: "A few clicks away", delay: 0.8 },
  { x: 655, y: 356, color: "var(--evnelo-sky)", label: "Ticketing", sub: "Sell with no limits", delay: 1.0 },
  { x: 805, y: 221, color: "#F5B342", label: "Check-in", sub: "Fast. Friendly. Flexible.", delay: 1.3 },
  { x: 940, y: 180, color: "var(--evnelo-pulse)", label: "Attendance", sub: "Real people.\nLasting impact.", delay: 1.55 },
];
const PATH = "M 210 502 C 320 502, 400 381, 490 351 S 600 373, 655 356 S 770 311, 805 221 S 890 180, 940 180";
const px = (x: number) => (x / VB.w) * 100;
const py = (y: number) => (y / VB.h) * 100;
/** A card centred over its node, bottom edge just above the line. `h` is the card height as % of the hero width. */
const over = (node: { x: number; y: number }, w: number, h: number, gapW = 0.6) => ({ x: px(node.x) - w / 2, y: py(node.y) - ((h + gapW) / (VB.h / VB.w)) });
const ease = [0.2, 0.7, 0.2, 1] as const;

function Sparkle({ color, x, y, rotate, delay }: { color: string; x: number; y: number; rotate: number; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg viewBox="0 0 24 24" className="hero-sparkle" style={{ left: `${x}%`, top: `${y}%`, rotate: `${rotate}deg` }} aria-hidden
      initial={reduce ? false : { opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay, duration: 0.4, ease }}>
      <g stroke={color}><line x1="12" y1="3" x2="12" y2="9" /><line x1="4" y1="7" x2="8.5" y2="11" /><line x1="20" y1="7" x2="15.5" y2="11" /></g>
    </motion.svg>
  );
}

/** A card that settles into place once; no idle loop, so the scene reads as a still composition. */
function Card({ x, y, w, rotate, delay, className, children }: { x: number; y: number; w: number; rotate: number; delay: number; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={`hero-card ${className ?? ""}`} style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, rotate: `${rotate}deg` }}
      initial={reduce ? false : { opacity: 0, y: 22, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay, duration: 0.65, ease }}>
      {children}
    </motion.div>
  );
}

function FakeQr() {
  const rows = "1101011 1000101 1011101 0110010 1011101 1000101 1101011".split(" ");
  return <div className="grid grid-cols-7 gap-[0.1cqw]" aria-hidden>{rows.flatMap((r, y) => r.split("").map((c, x) => <span key={`${x}${y}`} className={c === "1" ? "aspect-square bg-ink" : "aspect-square"} />))}</div>;
}

export function HeroScene() {
  const reduce = useReducedMotion();
  return (
    <div className="hero-scene" aria-hidden>
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" className="inset-0 size-full" fill="none">
        <defs>
          <linearGradient id="hero-flow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--evnelo-pulse)" /><stop offset="0.38" stopColor="var(--evnelo-lime)" /><stop offset="0.6" stopColor="var(--evnelo-sky)" /><stop offset="0.82" stopColor="#F5B342" /><stop offset="1" stopColor="var(--evnelo-pulse)" />
          </linearGradient>
        </defs>
        {/* no non-scaling-stroke: it recomputes dashes in screen space and cuts the draw animation short */}
        <motion.path d={PATH} stroke="url(#hero-flow)" strokeWidth="13" strokeLinecap="round" opacity="0.92"
          initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.9, ease: "easeInOut", delay: 0.1 }} />
      </svg>
      {/* nodes as HTML so they stay round when the SVG stretches */}
      {NODES.map((n) => (
        <motion.span key={n.label} className="block size-[1.6cqw] rounded-full border-[0.3cqw] border-white" style={{ left: `${px(n.x)}%`, top: `${py(n.y)}%`, translate: "-50% -50%", background: n.color, boxShadow: "0 0.2cqw 0.6cqw rgb(20 21 26 / 0.12)" }}
          initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: n.delay, type: "spring", stiffness: 380, damping: 18 }} />
      ))}
      {NODES.map((n) => (
        <motion.div key={n.label} className="text-center" style={{ left: `${px(n.x)}%`, top: `${py(n.y) + 3.2}%`, translate: "-50% 0" }} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: n.delay + 0.15, duration: 0.45, ease }}>
          <p className="hero-label">{n.label}</p><p className="hero-sub">{n.sub}</p>
        </motion.div>
      ))}

      {/* Discover: the event card rests on the first climb */}
      <Card x={38 - 7} y={66} w={14} rotate={-6} delay={0.35}>
        <div className="relative aspect-[16/9] bg-muted">
          <img src={COVER} alt="" className="size-full object-cover" loading="eager" />
          <span className="absolute right-[6%] top-[10%] flex size-[2cqw] items-center justify-center rounded-full bg-white text-ink"><Heart className="size-[1cqw]" /></span>
        </div>
        <div className="p-[0.9cqw]">
          <p className="eyebrow text-[0.6cqw]">Music</p>
          <p className="mt-[0.1cqw] text-[1.1cqw] font-bold leading-tight tracking-tight">Sunset Sessions</p>
          <p className="mt-[0.3cqw] flex items-center gap-[0.4cqw] whitespace-nowrap text-[0.7cqw] text-muted-foreground"><CalendarDays className="size-[0.75cqw]" /> Sat, Aug 24, 2024 <MapPin className="ml-[0.2cqw] size-[0.75cqw]" /> Riverside Park</p>
        </div>
      </Card>
      <Sparkle color="var(--evnelo-pulse)" x={46} y={62} rotate={-40} delay={0.9} />

      {/* Register: create-event card, its base on the line */}
      <Card {...over(NODES[1]!, 11.5, 8.4)} w={11.5} rotate={4} delay={0.85} className="p-[1cqw]">
        <p className="text-[0.95cqw] font-semibold">Create your event</p>
        <div className="mt-[0.6cqw] h-[0.5cqw] w-[78%] rounded-full bg-mist" />
        <div className="mt-[0.4cqw] h-[0.5cqw] w-[52%] rounded-full bg-mist" />
        <div className="mt-[0.9cqw] inline-flex items-center rounded-[0.55cqw] bg-ink px-[0.9cqw] py-[0.45cqw] text-[0.7cqw] font-semibold text-paper">Publish event</div>
      </Card>
      <Sparkle color="var(--evnelo-lime)" x={px(NODES[1]!.x) + 6.5} y={over(NODES[1]!, 11.5, 8.4).y - 4} rotate={20} delay={1.3} />

      {/* Ticketing: the ticket, base on the line */}
      <Card {...over(NODES[2]!, 15.5, 6.6)} w={15.5} rotate={-3} delay={1.05} className="hero-ticket flex">
        <div className="flex-1 p-[0.9cqw]">
          <p className="text-[0.65cqw] font-semibold text-pulse">Evnelo</p>
          <p className="mt-[0.2cqw] whitespace-nowrap text-[0.95cqw] font-bold leading-tight tracking-tight">General Admission</p>
          <p className="mt-[0.3cqw] text-[0.65cqw] leading-snug text-muted-foreground">Sat, Aug 24, 2024<br />Riverside Park</p>
        </div>
        <div className="flex w-[32%] items-center justify-center border-l-[0.12cqw] border-dashed border-mist p-[0.7cqw]"><FakeQr /></div>
      </Card>
      <Sparkle color="var(--evnelo-sky)" x={px(NODES[2]!.x) + 8.5} y={over(NODES[2]!, 15.5, 6.6).y - 4} rotate={10} delay={1.45} />

      {/* Check-in: confirmation card above its node */}
      <Card {...over(NODES[3]!, 9.5, 9.8)} w={9.5} rotate={3} delay={1.35} className="p-[0.9cqw] text-center">
        <span className="mx-auto flex size-[2.1cqw] items-center justify-center rounded-full bg-lime text-ink"><Check className="size-[1.2cqw]" strokeWidth={3} /></span>
        <p className="mt-[0.6cqw] whitespace-nowrap text-[0.75cqw] font-semibold">Attendee checked in</p>
        <p className="text-[0.65cqw] text-muted-foreground">Welcome!</p>
      </Card>
      <Sparkle color="var(--evnelo-pulse)" x={px(NODES[3]!.x) - 7} y={over(NODES[3]!, 9.5, 9.8).y + 8} rotate={-60} delay={1.7} />

      {/* Attendance: stat card, avatars above it */}
      <Card {...over(NODES[4]!, 11.5, 4.9)} w={11.5} rotate={-2} delay={1.6} className="flex items-end justify-between p-[0.9cqw]">
        <div><p className="text-[1.5cqw] font-bold leading-none tracking-tight">1,024</p><p className="mt-[0.25cqw] whitespace-nowrap text-[0.65cqw] text-muted-foreground">people attended</p></div>
        <BarChart3 className="size-[1.7cqw] text-pulse" />
      </Card>
      <motion.div className="flex items-center" style={{ left: `${px(NODES[4]!.x)}%`, top: `${over(NODES[4]!, 11.5, 4.9).y - 6.4}%`, translate: "-50% 0" }} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8, duration: 0.5, ease }}>
        {AVATARS.map((n, i) => <img key={n} src={`https://i.pravatar.cc/80?img=${n}`} alt="" className="size-[2.5cqw] rounded-full border-[0.18cqw] border-white object-cover" style={{ marginLeft: i ? "-0.7cqw" : 0 }} loading="lazy" />)}
        <span className="ml-[-0.7cqw] flex size-[2.5cqw] items-center justify-center rounded-full border-[0.18cqw] border-white bg-mist text-[0.65cqw] font-semibold">+832</span>
      </motion.div>
      <Sparkle color="var(--evnelo-pulse)" x={px(NODES[4]!.x) + 4.5} y={over(NODES[4]!, 11.5, 4.9).y - 10.5} rotate={40} delay={2} />

      {/* handwritten notes in the two empty corners */}
      <motion.p className="hero-note" style={{ left: "2%", top: "80%", rotate: "-6deg" }} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.6 }}>More events.<br />A more open world.</motion.p>
      <motion.p className="hero-note text-right" style={{ right: "2%", top: "80%", rotate: "-6deg" }} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.1, duration: 0.6 }}>Events<br />move people.</motion.p>
    </div>
  );
}
