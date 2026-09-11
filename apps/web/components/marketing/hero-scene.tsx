"use client";

import { motion, useReducedMotion } from "motion/react";
import { BarChart3, CalendarDays, Check, Heart, MapPin } from "lucide-react";
import "./hero.css";

const COVER = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&q=70";
const AVATARS = [32, 47, 5];

/** Scene coordinates are a 1000×690 box; everything below is placed in percent of it so it scales as one piece. */
const NODES = [
  { x: 50, y: 635, color: "var(--evnelo-pulse)", label: "Discover", sub: "Find what moves you", lx: 8, ly: 94, delay: 0.15 },
  { x: 490, y: 435, color: "var(--evnelo-lime)", label: "Register", sub: "A few clicks away", lx: 46.5, ly: 68, delay: 0.75 },
  { x: 660, y: 440, color: "var(--evnelo-sky)", label: "Ticketing", sub: "Sell with no limits", lx: 63, ly: 69, delay: 0.95 },
  { x: 820, y: 275, color: "#F5B342", label: "Check-in", sub: "Fast. Friendly. Flexible.", lx: 84, ly: 41.5, delay: 1.25 },
  { x: 950, y: 225, color: "var(--evnelo-pulse)", label: "Attendance", sub: "Real people.\nLasting impact.", lx: 84.5, ly: 49, delay: 1.5 },
];
const PATH = "M 50 635 C 220 635, 330 470, 490 435 S 600 455, 660 440 S 775 385, 820 275 S 905 225, 950 225";

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

/** A card that rises into place, then drifts. Two layers so the entrance and the loop don't fight. */
function Card({ x, y, w, rotate, delay, className, children }: { x: number; y: number; w: number; rotate: number; delay: number; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, rotate: `${rotate}deg` }}
      initial={reduce ? false : { opacity: 0, y: 28, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay, duration: 0.7, ease }}>
      <motion.div className={`hero-card ${className ?? ""}`} animate={reduce ? undefined : { y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 6 + delay, ease: "easeInOut", delay: delay + 1 }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

function FakeQr() {
  const rows = "1101011 1000101 1011101 0110010 1011101 1000101 1101011".split(" ");
  return <div className="grid grid-cols-7 gap-[0.16cqw]" aria-hidden>{rows.flatMap((r, y) => r.split("").map((c, x) => <span key={`${x}${y}`} className={c === "1" ? "aspect-square bg-ink" : "aspect-square"} />))}</div>;
}

export function HeroScene() {
  const reduce = useReducedMotion();
  return (
    <div className="hero-scene" aria-hidden>
      <svg viewBox="0 0 1000 690" className="inset-0 size-full" fill="none">
        <defs>
          <linearGradient id="hero-flow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--evnelo-pulse)" /><stop offset="0.35" stopColor="var(--evnelo-lime)" /><stop offset="0.6" stopColor="var(--evnelo-sky)" /><stop offset="0.82" stopColor="#F5B342" /><stop offset="1" stopColor="var(--evnelo-pulse)" />
          </linearGradient>
        </defs>
        <motion.path d={PATH} stroke="url(#hero-flow)" strokeWidth="20" strokeLinecap="round" opacity="0.9"
          initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease: "easeInOut", delay: 0.1 }} />
        {NODES.map((n) => (
          <motion.circle key={n.label} cx={n.x} cy={n.y} r="14" fill={n.color} stroke="var(--evnelo-white)" strokeWidth="5" style={{ transformOrigin: `${n.x}px ${n.y}px` }}
            initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: n.delay, type: "spring", stiffness: 380, damping: 18 }} />
        ))}
      </svg>

      {NODES.map((n) => (
        <motion.div key={n.label} style={{ left: `${n.lx}%`, top: `${n.ly}%` }} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: n.delay + 0.15, duration: 0.45, ease }}>
          <p className="hero-label">{n.label}</p><p className="hero-sub whitespace-pre-line">{n.sub}</p>
        </motion.div>
      ))}

      {/* Discover: event card above the first segment */}
      <Card x={19} y={50} w={23} rotate={-6} delay={0.35}>
        <div className="relative aspect-[16/9] bg-muted">
          <img src={COVER} alt="" className="size-full object-cover" loading="eager" />
          <span className="absolute right-[6%] top-[10%] flex size-[3cqw] items-center justify-center rounded-full bg-white text-ink"><Heart className="size-[1.5cqw]" /></span>
        </div>
        <div className="p-[1.3cqw]">
          <p className="eyebrow text-[0.95cqw]">Music</p>
          <p className="mt-[0.2cqw] text-[1.7cqw] font-bold leading-tight tracking-tight">Sunset Sessions</p>
          <p className="mt-[0.45cqw] flex items-center gap-[0.6cqw] whitespace-nowrap text-[1.05cqw] text-muted-foreground"><CalendarDays className="size-[1.1cqw]" /> Sat, Aug 24, 2024 <MapPin className="ml-[0.3cqw] size-[1.1cqw]" /> Riverside Park</p>
        </div>
      </Card>
      <Sparkle color="var(--evnelo-pulse)" x={15} y={47} rotate={-40} delay={0.9} />

      {/* Register: create-event card above its node */}
      <Card x={44} y={32} w={18} rotate={4} delay={0.85} className="p-[1.5cqw]">
        <p className="text-[1.4cqw] font-semibold">Create your event</p>
        <div className="mt-[0.9cqw] h-[0.8cqw] w-[78%] rounded-full bg-mist" />
        <div className="mt-[0.6cqw] h-[0.8cqw] w-[52%] rounded-full bg-mist" />
        <div className="mt-[1.3cqw] inline-flex items-center rounded-[0.8cqw] bg-ink px-[1.3cqw] py-[0.65cqw] text-[1.05cqw] font-semibold text-paper">Publish event</div>
      </Card>
      <Sparkle color="var(--evnelo-lime)" x={63} y={30} rotate={20} delay={1.3} />

      {/* Ticketing: the ticket, to the right of the create card, above its node */}
      <Card x={61} y={50} w={22} rotate={-3} delay={1.05} className="hero-ticket flex">
        <div className="flex-1 p-[1.3cqw]">
          <p className="text-[0.95cqw] font-semibold text-pulse">Evnelo</p>
          <p className="mt-[0.3cqw] whitespace-nowrap text-[1.4cqw] font-bold leading-tight tracking-tight">General Admission</p>
          <p className="mt-[0.4cqw] text-[0.95cqw] leading-snug text-muted-foreground">Sat, Aug 24, 2024<br />Riverside Park</p>
        </div>
        <div className="flex w-[32%] items-center justify-center border-l-[0.18cqw] border-dashed border-mist p-[1cqw]"><FakeQr /></div>
      </Card>
      <Sparkle color="var(--evnelo-sky)" x={57} y={47} rotate={10} delay={1.45} />

      {/* Check-in: confirmation card above its node */}
      <Card x={69} y={17} w={15} rotate={3} delay={1.35} className="p-[1.4cqw] text-center">
        <span className="mx-auto flex size-[3.2cqw] items-center justify-center rounded-full bg-lime text-ink"><Check className="size-[1.8cqw]" strokeWidth={3} /></span>
        <p className="mt-[0.9cqw] whitespace-nowrap text-[1.15cqw] font-semibold">Attendee checked in</p>
        <p className="text-[0.95cqw] text-muted-foreground">Welcome!</p>
      </Card>
      <Sparkle color="var(--evnelo-pulse)" x={66} y={27} rotate={-60} delay={1.7} />

      {/* Attendance: stat card and avatars, top right, clear of the check-in card */}
      <Card x={86} y={20} w={14} rotate={-2} delay={1.6} className="flex items-end justify-between p-[1.3cqw]">
        <div><p className="text-[2.3cqw] font-bold leading-none tracking-tight">1,024</p><p className="mt-[0.35cqw] whitespace-nowrap text-[0.95cqw] text-muted-foreground">people attended</p></div>
        <BarChart3 className="size-[2.6cqw] text-pulse" />
      </Card>
      <motion.div className="flex items-center" style={{ left: "86.5%", top: "10%" }} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8, duration: 0.5, ease }}>
        {AVATARS.map((n, i) => <img key={n} src={`https://i.pravatar.cc/80?img=${n}`} alt="" className="size-[3.8cqw] rounded-full border-[0.28cqw] border-white object-cover" style={{ marginLeft: i ? "-1.1cqw" : 0 }} loading="lazy" />)}
        <span className="ml-[-1.1cqw] flex size-[3.8cqw] items-center justify-center rounded-full border-[0.28cqw] border-white bg-mist text-[1cqw] font-semibold">+832</span>
      </motion.div>
      <Sparkle color="var(--evnelo-pulse)" x={97} y={4} rotate={40} delay={2} />

      {/* handwritten notes, in the two empty corners */}
      <motion.p className="hero-note" style={{ left: "0%", top: "76%", rotate: "-6deg" }} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.6 }}>More events.<br />A more open world.</motion.p>
      <motion.p className="hero-note text-right" style={{ right: "0%", top: "80%", rotate: "-6deg" }} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.1, duration: 0.6 }}>Events<br />move people.</motion.p>
    </div>
  );
}
