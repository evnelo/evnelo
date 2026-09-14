"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A value whose characters pop back in when it changes (transitions.dev number pop-in): each one re-enters with a
 * blurred slide, the last two a beat behind. Nothing animates on first render. Works on any short string, so a
 * formatted price is fine.
 */
export function PopNumber({ value, className }: { value: string; className?: string }) {
  const [run, setRun] = useState(0);
  const last = useRef(value);
  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    setRun((n) => n + 1); // remounting the group restarts the keyframes
  }, [value]);
  const chars = Array.from(value);
  return (
    <span key={run} className={cn("t-digit-group", run > 0 && "is-animating", className)}>
      {chars.map((ch, i) => (
        <span key={i} className="t-digit" data-stagger={i === chars.length - 2 ? 1 : i === chars.length - 1 ? 2 : undefined}>{ch}</span>
      ))}
    </span>
  );
}
