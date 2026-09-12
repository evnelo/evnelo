import Link from "next/link";
import { cn } from "@/lib/utils";

export type LinkTab = { key: string; label: string; href: string };

/** Underlined tabs that are plain links, so each tab has a URL and works before hydration. */
export function LinkTabs({ tabs, active, className }: { tabs: LinkTab[]; active: string; className?: string }) {
  return (
    <nav aria-label="Sections" className={cn("no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-border/70 px-1", className)}>
      {tabs.map((t) => {
        const current = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            scroll={false}
            aria-current={current ? "page" : undefined}
            className={cn(
              "press relative shrink-0 rounded-t-md px-3 py-2.5 text-sm transition-colors after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors",
              current ? "font-medium text-foreground after:bg-pulse" : "text-muted-foreground after:bg-transparent hover:text-foreground hover:after:bg-border",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
