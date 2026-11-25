import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/brand";
import { requireAdmin } from "@/lib/admin";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return { title: t("admin.meta.title"), robots: "noindex" };
}

/** Platform operators only (ADMIN_EMAILS). Lives outside /dashboard because it is not scoped to an organization. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, t] = await Promise.all([requireAdmin(), getTranslations("dashboard")]);
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border/70 bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4">
          <div className="flex items-center gap-4">
            {/* plain links: the public site runs analytics cookieless, the dashboard identified */}
            <a href="/" className="press rounded-md"><Brand /></a>
            <Link href="/admin" className="eyebrow rounded-md text-muted-foreground hover:text-foreground">{t("admin.shell.eyebrow")}</Link>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="truncate" title={user.email}>{user.email}</span>
            <a href="/dashboard" className="font-medium text-foreground underline-offset-4 hover:underline">{t("admin.shell.backToDashboard")}</a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 lg:py-10">{children}</main>
    </div>
  );
}
