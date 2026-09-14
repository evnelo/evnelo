"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A pill switcher for a few mutually exclusive views (transitions.dev tabs sliding). One pill slides and resizes to
 * the selected tab; its first position is written without a transition so it never travels in from the edge.
 */
export function Segmented<T extends string>({ value, options, onChange, label, className }: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const place = (animate: boolean) => {
      const tab = bar.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`);
      const el = pill.current;
      if (!tab || !el) return;
      if (!animate) el.style.transition = "none";
      el.style.transform = `translateX(${tab.offsetLeft}px)`;
      el.style.width = `${tab.offsetWidth}px`;
      if (!animate) { void el.offsetWidth; el.style.transition = ""; }
    };
    place(pill.current?.style.width !== ""); // first paint (no width yet) snaps, later changes slide
    const onResize = () => place(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [value]);
  return (
    <div ref={bar} role="group" aria-label={label} className={cn("t-tabs flex rounded-full border border-border/80 bg-muted/50 p-1", className)}>
      <span ref={pill} aria-hidden className="t-tabs-pill rounded-full bg-card shadow-card" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          data-value={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("t-tab press inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm", value === o.value ? "font-medium text-foreground" : "text-muted-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
