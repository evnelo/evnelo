"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Clock3, Gauge, Mail, Receipt, ScanLine, SlidersHorizontal, Ticket, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: typeof Gauge; count?: number; absolute?: (id: string) => string };

export function EventNav({ id, counts }: { id: string; counts?: { attendees?: number; waitlist?: number } }) {
  const path = usePathname();
  const base = `/dashboard/events/${id}`;
  const tabs: Tab[] = [
    { href: "", label: "Overview", icon: Gauge },
    { href: "/edit", label: "Edit", icon: SlidersHorizontal },
    { href: "/tickets", label: "Tickets", icon: Ticket },
    { href: "/form", label: "Form", icon: ClipboardList },
    { href: "/invites", label: "Invites", icon: Mail },
    { href: "/attendees", label: "Attendees", icon: Users, count: counts?.attendees },
    { href: "/waitlist", label: "Waitlist", icon: Clock3, count: counts?.waitlist },
    { href: "/orders", label: "Orders", icon: Receipt },
    { href: "/checkin", label: "Check-in", icon: ScanLine, absolute: (eventId) => `/dashboard/checkin/${eventId}` },
  ];
  return (
    // bleeds to the gutter on a phone so the scroll runs edge to edge, aligns with the page from sm up
    <nav className="no-scrollbar -mx-4 mt-6 overflow-x-auto overflow-y-hidden px-4 sm:mx-0 sm:px-0">
      {/* the rule lives on the scrolling row so the active tab's border overlaps it without overflowing the container */}
      <div className="flex min-w-full w-max gap-0.5 border-b border-border/80">
        {tabs.map((t) => {
          const href = t.absolute ? t.absolute(id) : base + t.href;
          const active = t.href === "" ? path === base : path.startsWith(href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press -mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm",
                active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] tabular-nums leading-none", active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{t.count}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
