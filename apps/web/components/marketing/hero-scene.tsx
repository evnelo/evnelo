"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Check, Heart, MapPin } from "lucide-react";

const AVATARS = [32, 47, 5];
const ease = [0.2, 0.7, 0.2, 1] as const;
// Shared 1000 × 620 canvas: checkpoints, cards and ribbon scale together. Labels live in public.json
// under hero.scene.steps.{id}; the geometry here is deliberately physical (see AGENTS.md).
const STEPS = [
  { id: "discover", x: 330, y: 560, color: "var(--evnelo-pulse)", delay: 0.15 },
  { id: "register", x: 490, y: 350, color: "var(--evnelo-lime)", delay: 0.8 },
  { id: "ticketing", x: 655, y: 356, color: "var(--evnelo-sky)", delay: 1.0 },
  { id: "checkin", x: 805, y: 219, color: "#F5B342", delay: 1.3 },
  { id: "attendance", x: 932, y: 180, color: "var(--evnelo-pulse)", delay: 1.55 },
] as const;
const PATH = "M330 560 C300 515 300 474 330 440 C378 432 397 323 490 350 C544 315 592 402 655 356 C729 331 735 211 805 219 C852 238 872 172 932 180";
const ATTENDED = 1024;
const MORE_AVATARS = 832;

function Sparkle({ color, className }: { color: string; className: string }) {
  return (
    <svg viewBox="0 0 28 28" className={`hero-sparkle ${className}`} fill="none">
      <g stroke={color}><path d="M7 18 3 6M14 17 18 3M20 21 27 15" /></g>
    </svg>
  );
}

function Step({ step, children, adornment }: { step: typeof STEPS[number]; children: ReactNode; adornment?: ReactNode }) {
  const reduce = useReducedMotion();
  const t = useTranslations("public");
  return (
    <div className={`hero-step hero-step-${step.id}`} style={{
      "--node-x": `${step.x / 10}%`, "--node-y": `${step.y / 620 * 100}%`, "--node-color": step.color,
    } as CSSProperties}>
      <motion.span className="hero-node" initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: step.delay, type: "spring", stiffness: 380, damping: 18 }} />
      <motion.div className="hero-caption" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: step.delay + 0.15, duration: 0.45, ease }}>
        <p className="hero-label">{t(`hero.scene.steps.${step.id}.label`)}</p><p className="hero-sub">{t(`hero.scene.steps.${step.id}.sub`)}</p>
      </motion.div>
      {adornment && (
        <motion.div className="hero-adornment" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: step.delay + 0.15, duration: 0.65, ease }}>
          {adornment}
        </motion.div>
      )}
      <motion.div className="hero-card-wrap" initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: step.delay + 0.15, duration: 0.65, ease }}>
        {children}
      </motion.div>
    </div>
  );
}

export function HeroScene() {
  const reduce = useReducedMotion();
  const t = useTranslations("public");
  const locale = useLocale();
  const br = () => <br />;
  return (
    <div className="hero-scene" aria-hidden="true">
      <svg viewBox="0 0 1000 620" className="hero-ribbon" fill="none">
        <defs>
          <linearGradient id="hero-flow" gradientUnits="userSpaceOnUse" x1="210" y1="0" x2="932" y2="0">
            <stop stopColor="var(--evnelo-pulse)" /><stop offset="0.23" stopColor="#FFD17C" /><stop offset="0.39" stopColor="var(--evnelo-lime)" /><stop offset="0.59" stopColor="var(--evnelo-sky)" /><stop offset="0.70" stopColor="var(--evnelo-sky)" /><stop offset="0.79" stopColor="#FFD17C" /><stop offset="1" stopColor="var(--evnelo-pulse)" />
          </linearGradient>
        </defs>
        <motion.path d={PATH} stroke="url(#hero-flow)" strokeWidth="20" strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.9, ease: "easeInOut", delay: 0.1 }} />
      </svg>

      <Step step={STEPS[0]}>
        <div className="hero-card hero-event-card">
          <div className="hero-event-cover">
            <img src="/marketing/sunset-sessions.jpg" alt="" width={640} height={427} loading="eager" />
            <span className="hero-heart"><Heart /></span>
          </div>
          <div className="hero-event-body">
            <p className="hero-category">{t("hero.scene.event.category")}</p>
            <p className="hero-event-title">{t("hero.scene.event.title")}</p>
            <p className="hero-event-meta"><span><CalendarDays /> {t("hero.scene.event.date")}</span><span><MapPin /> {t("hero.scene.event.place")}</span></p>
          </div>
        </div>
        <Sparkle color="var(--evnelo-pulse)" className="hero-event-sparkle" />
      </Step>

      <Step step={STEPS[1]}>
        <div className="hero-card hero-create-card">
          <p>{t("hero.scene.create.title")}</p>
          <div className="hero-input-line" /><div className="hero-input-line hero-input-short" />
          <div className="hero-publish">{t("hero.scene.create.publish")}</div>
        </div>
        <Sparkle color="var(--evnelo-lime)" className="hero-create-sparkle" />
      </Step>

      <Step step={STEPS[2]}>
        <div className="hero-card hero-ticket">
          <div className="hero-ticket-body">
            <p className="hero-ticket-brand">Evnelo</p>
            <p className="hero-ticket-title">{t("hero.scene.ticket.title")}</p>
            <p className="hero-ticket-meta">{t.rich("hero.scene.ticket.meta", { br })}</p>
          </div>
          <img className="hero-qr" src="/marketing/demo-ticket-qr.svg" alt="" width={60} height={60} />
          <div className="hero-ticket-stub"><span>EVNELO</span></div>
        </div>
        <Sparkle color="var(--evnelo-sky)" className="hero-ticket-sparkle" />
      </Step>

      <Step step={STEPS[3]}>
        <div className="hero-card hero-checkin-card">
          <span className="hero-check"><Check strokeWidth={3} /></span>
          <p>{t("hero.scene.checkin.title")}</p><span className="hero-welcome">{t("hero.scene.checkin.welcome")}</span>
        </div>
        <Sparkle color="var(--evnelo-pulse)" className="hero-checkin-sparkle" />
      </Step>

      <Step step={STEPS[4]} adornment={
        <div className="hero-avatars">
          {AVATARS.map((n) => <img key={n} src={`https://i.pravatar.cc/80?img=${n}`} alt="" width={80} height={80} loading="eager" />)}
          <span>{t("hero.scene.attendance.more", { count: MORE_AVATARS })}</span>
        </div>
      }>
        <div className="hero-card hero-attendance-card">
          <div><p className="hero-attendance-total">{new Intl.NumberFormat(locale).format(ATTENDED)}</p><p className="hero-attendance-meta">{t("hero.scene.attendance.meta")}</p></div>
          <div className="hero-bars"><i /><i /><i /></div>
        </div>
        <Sparkle color="var(--evnelo-pulse)" className="hero-attendance-sparkle" />
      </Step>

      <p className="hero-note hero-note-left">{t.rich("hero.scene.notes.left", { br })}</p>
      <p className="hero-note hero-note-right">{t.rich("hero.scene.notes.right", { br })}</p>
    </div>
  );
}
