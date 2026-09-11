import { cn } from "@/lib/utils";

/** The wordmark with a small ticket glyph. One place, so the header, footer, emails and auth pages agree. */
export function Brand({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg sm:text-xl";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg aria-hidden viewBox="0 0 24 24" className={cn("shrink-0 text-primary", size === "lg" ? "size-7" : "size-5")} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M3.5 8.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v1.2a1.8 1.8 0 0 0 0 3.6v1.2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-1.2a1.8 1.8 0 0 0 0-3.6z" />
        <path d="M9.5 6.5v10" strokeDasharray="1.5 2.2" strokeLinecap="round" />
      </svg>
      <span className={cn("font-display", dims)} style={{ fontVariationSettings: '"opsz" 24, "SOFT" 100' }}>OpenTicket</span>
    </span>
  );
}
