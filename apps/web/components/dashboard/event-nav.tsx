"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BarChart3, ClipboardList, Clock3, Gauge, Mail, Receipt, ScanLine, SlidersHorizontal, Ticket, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: typeof Gauge; count?: number; absolute?: (id: string) => string };

export function EventNav({ id, counts }: { id: string; counts?: { attendees?: number; waitlist?: number } }) {
  const path = usePathname();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const base = `/dashboard/events/${id}`;
  const tabs: Tab[] = [
    { href: "", label: t("event.nav.overview"), icon: Gauge },
    { href: "/analytics", label: t("event.nav.analytics"), icon: BarChart3 },
    { href: "/edit", label: tc("actions.edit"), icon: SlidersHorizontal },
    { href: "/tickets", label: t("event.nav.tickets"), icon: Ticket },
    { href: "/form", label: t("event.nav.form"), icon: ClipboardList },
    { href: "/invites", label: t("event.nav.invites"), icon: Mail },
    { href: "/attendees", label: t("event.nav.attendees"), icon: Users, count: counts?.attendees },
    { href: "/waitlist", label: t("event.nav.waitlist"), icon: Clock3, count: counts?.waitlist },
    { href: "/orders", label: t("event.nav.orders"), icon: Receipt },
    { href: "/checkin", label: t("event.nav.checkin"), icon: ScanLine, absolute: (eventId) => `/dashboard/checkin/${eventId}` },
  ];
  return (
    // bleeds to the gutter on a phone so the scroll runs edge to edge, aligns with the page from sm up
    <nav className="no-scrollbar -mx-4 mt-6 overflow-x-auto overflow-y-hidden px-4 sm:mx-0 sm:px-0">
      {/* the rule lives on the scrolling row so the active tab's border overlaps it without overflowing the container */}
      <div className="flex min-w-full w-max gap-0.5 border-b border-border/80">
        {tabs.map((tab) => {
          const href = tab.absolute ? tab.absolute(id) : base + tab.href;
          const active = tab.href === "" ? path === base : path.startsWith(href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press -mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm",
                active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] tabular-nums leading-none", active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{tab.count}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
