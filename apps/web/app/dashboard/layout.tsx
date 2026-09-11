import Link from "next/link";
import { LogOut } from "lucide-react";
import { can } from "@ot/core";
import { requireOrg } from "@/lib/auth/session";
import { signOutAction, switchOrgAction } from "./actions";
import { Brand } from "@/components/brand";
import { Select } from "@/components/ui/select";
import { SidebarNav, type SidebarItem } from "@/components/dashboard/sidebar-nav";

export const metadata = { title: "Dashboard", robots: "noindex" };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, org, role, memberships } = await requireOrg(undefined, "/dashboard");
  const items: SidebarItem[] = [
    ...(can(role, "view_events") ? [{ href: "/dashboard", label: "Events", icon: "events" as const }] : []),
    ...(can(role, "check_in") ? [{ href: "/dashboard/checkin", label: "Check-in", icon: "checkin" as const }] : []),
    ...(can(role, "view_events") ? [{ href: "/dashboard/settings", label: "Settings", icon: "settings" as const }] : []),
  ];
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="flex flex-col border-b border-border/70 bg-muted/40 lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-5">
          <Link href="/" className="press rounded-md"><Brand /></Link>
          {memberships.length > 1 ? (
            <form action={async (fd) => { "use server"; await switchOrgAction(String(fd.get("org"))); }} className="lg:mt-4">
              <Select name="org" defaultValue={org.id} className="h-9 text-xs" aria-label="Organization">
                {memberships.map((m) => <option key={m.org.id} value={m.org.id}>{m.org.name}</option>)}
              </Select>
              <button className="mt-1 hidden text-xs text-muted-foreground underline underline-offset-4 lg:block">Switch organization</button>
            </form>
          ) : (
            <p className="truncate text-sm text-muted-foreground lg:mt-3"><span className="eyebrow block lg:mb-0.5">Organization</span><span className="text-foreground">{org.name}</span></p>
          )}
        </div>
        <SidebarNav items={items} />
        <div className="mt-auto hidden border-t border-border/70 px-5 py-4 text-xs text-muted-foreground lg:block">
          <p className="truncate text-foreground" title={user.email}>{user.name ?? user.email}</p>
          <p className="truncate">{user.name ? user.email : ""}</p>
          <form action={signOutAction} className="mt-2"><button className="press inline-flex items-center gap-1.5 rounded-md hover:text-foreground"><LogOut className="size-3.5" /> Sign out</button></form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
