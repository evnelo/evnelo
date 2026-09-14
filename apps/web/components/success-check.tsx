import { cn } from "@/lib/utils";

/**
 * A check that fades in, rotates upright, bobs and draws its own stroke (transitions.dev success check). The span
 * is the coloured disc; size and colours come from className, the icon size in px. Path length 19.8, so 21.
 */
export function SuccessCheck({ className, iconSize = 32 }: { className?: string; iconSize?: number }) {
  return (
    <span className={cn("t-success-check flex items-center justify-center rounded-full", className)} style={{ "--check-len": 21 } as React.CSSProperties} aria-hidden>
      <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}
