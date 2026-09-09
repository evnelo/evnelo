import Link from "next/link";
import { CalendarDays, Settings } from "lucide-react";
import { requireOrg } from "@/lib/auth/session";
import { signOutAction, switchOrgAction } from "./actions";
import { Select } from "@/components/ui/select";

export const metadata = { title: "Dashboard", robots: "noindex" };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, org, memberships } = await requireOrg(undefined, "/dashboard");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[15rem_1fr]">
      <aside className="flex flex-col border-b bg-card/60 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3 lg:block lg:py-4">
          <Link href="/" className="font-display text-lg" style={{ fontVariationSettings: '"opsz" 24, "SOFT" 100' }}>OpenTicket</Link>
          {memberships.length > 1 ? (
            <form action={async (fd) => { "use server"; await switchOrgAction(String(fd.get("org"))); }} className="lg:mt-3">
              <Select name="org" defaultValue={org.id} onChange={undefined} className="h-8 text-xs" aria-label="Organization">
                {memberships.map((m) => <option key={m.org.id} value={m.org.id}>{m.org.name}</option>)}
              </Select>
              <button className="mt-1 text-xs text-muted-foreground underline underline-offset-4 lg:block">Switch</button>
            </form>
          ) : (
            <p className="truncate text-sm text-muted-foreground lg:mt-1">{org.name}</p>
          )}
        </div>
        <nav className="flex gap-1 px-2 pb-2 lg:flex-col lg:px-2 lg:pb-0">
          <Link href="/dashboard" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"><CalendarDays className="size-4" /> Events</Link>
          <Link href="/dashboard/settings" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"><Settings className="size-4" /> Settings</Link>
        </nav>
        <div className="mt-auto hidden border-t px-4 py-3 text-xs text-muted-foreground lg:block">
          <p className="truncate" title={user.email}>{user.name ?? user.email}</p>
          <form action={signOutAction}><button className="mt-1 underline underline-offset-4 hover:text-foreground">Sign out</button></form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
