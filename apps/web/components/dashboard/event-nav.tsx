"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs: { href: string; label: string; absolute?: (id: string) => string }[] = [
  { href: "", label: "Overview" }, { href: "/edit", label: "Edit" }, { href: "/tickets", label: "Tickets" },
  { href: "/form", label: "Form" }, { href: "/attendees", label: "Attendees" }, { href: "/orders", label: "Orders" },
  { href: "/checkin", label: "Check-in", absolute: (id) => `/dashboard/checkin/${id}` },
];

export function EventNav({ id }: { id: string }) {
  const path = usePathname();
  const base = `/dashboard/events/${id}`;
  return (
    <nav className="mt-5 flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => {
        const href = t.absolute ? t.absolute(id) : base + t.href;
        const active = t.href === "" ? path === base : path.startsWith(href);
        return (
          <Link key={t.href} href={href} className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm", active ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
