"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, ScanLine, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

// icon names, not components: this list comes from a server component and functions cannot cross that boundary
const ICONS = { events: CalendarDays, analytics: BarChart3, checkin: ScanLine, settings: Settings } as const;
export type SidebarItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean };

export function SidebarNav({ items }: { items: SidebarItem[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3 lg:pb-0">
      {items.map(({ href, label, icon, exact }) => {
        const Icon = ICONS[icon];
        const active = href === "/dashboard"
          ? path === "/dashboard" || path.startsWith("/dashboard/events")
          : exact ? path === href : path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "press flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
              active ? "bg-card font-medium text-foreground shadow-card" : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4", active ? "text-primary" : "")} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
