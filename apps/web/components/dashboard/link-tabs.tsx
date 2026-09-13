import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type LinkTab = { key: string; label: string; href: string };

/** Underlined tabs that are plain links, so each tab has a URL and works before hydration. */
export function LinkTabs({ tabs, active, className }: { tabs: LinkTab[]; active: string; className?: string }) {
  const t = useTranslations("dashboard");
  return (
    <nav aria-label={t("linkTabs.label")} className={cn("no-scrollbar -mx-1 overflow-x-auto overflow-y-hidden px-1", className)}>
      <div className="flex w-max min-w-full gap-1 border-b border-border/70">
      {tabs.map((tab) => {
        const current = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            scroll={false}
            aria-current={current ? "page" : undefined}
            className={cn(
              "press relative shrink-0 rounded-t-md px-3 py-2.5 text-sm transition-colors after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors",
              current ? "font-medium text-foreground after:bg-pulse" : "text-muted-foreground after:bg-transparent hover:text-foreground hover:after:bg-border",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
      </div>
    </nav>
  );
}
