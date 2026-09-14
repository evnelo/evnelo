import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { LogOut } from "lucide-react";
import { can } from "@evnelo/core";
import { requireOrg } from "@/lib/auth/session";
import { signOutAction, switchOrgAction } from "./actions";
import { Brand } from "@/components/brand";
import { Select } from "@/components/ui/select";
import { SidebarNav, type SidebarItem } from "@/components/dashboard/sidebar-nav";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { IdentifyUser } from "@/components/analytics";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return { title: t("meta.title"), robots: "noindex" };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [{ user, org, role, memberships }, t, tc] = await Promise.all([requireOrg(undefined, "/dashboard"), getTranslations("dashboard"), getTranslations("common")]);
  const items: SidebarItem[] = [
    ...(can(role, "view_events") ? [{ href: "/dashboard", label: t("nav.events"), icon: "events" as const }] : []),
    ...(can(role, "view_events") ? [{ href: "/dashboard/analytics", label: t("nav.analytics"), icon: "analytics" as const }] : []),
    ...(can(role, "check_in") ? [{ href: "/dashboard/checkin", label: t("nav.checkin"), icon: "checkin" as const }] : []),
    ...(can(role, "view_events") ? [{ href: "/dashboard/settings", label: t("nav.settings"), icon: "settings" as const }] : []),
  ];
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <IdentifyUser userId={user.id} organizationId={org.id} organizationName={org.name} role={role} />
      <aside className="flex flex-col border-b border-border/70 bg-muted/40 lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-e">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-5">
          {/* a plain link: the public site runs analytics cookieless, the dashboard identified, so the two never share a page load */}
          <a href="/" className="press rounded-md"><Brand /></a>
          {memberships.length > 1 ? (
            <form action={async (fd) => { "use server"; await switchOrgAction(String(fd.get("org"))); }} className="lg:mt-4">
              <Select name="org" defaultValue={org.id} className="h-9 text-xs" aria-label={t("shell.organization")}>
                {memberships.map((m) => <option key={m.org.id} value={m.org.id}>{m.org.name}</option>)}
              </Select>
              <SubmitButton variant="ghost" size="sm" className="mt-1 hidden h-7 px-2 text-xs text-muted-foreground lg:inline-flex">{t("shell.switchOrganization")}</SubmitButton>
            </form>
          ) : (
            <p className="truncate text-sm text-muted-foreground lg:mt-3"><span className="eyebrow block lg:mb-0.5">{t("shell.organization")}</span><span className="text-foreground">{org.name}</span></p>
          )}
        </div>
        <SidebarNav items={items} />
        <div className="mt-auto hidden border-t border-border/70 px-5 py-4 text-xs text-muted-foreground lg:block">
          <p className="truncate text-foreground" title={user.email}>{user.name ?? user.email}</p>
          <p className="truncate">{user.name ? user.email : ""}</p>
          <div className="mt-2 flex items-center gap-1"><LocaleSwitcher variant="plain" className="-ms-2 h-7 text-xs" /><form action={signOutAction}><SubmitButton variant="ghost" size="sm" className="-ms-2 h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground [&_svg]:size-3.5"><LogOut className="rtl:-scale-x-100" /> {tc("actions.signOut")}</SubmitButton></form></div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
