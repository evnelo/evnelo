import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { currentUser } from "@/lib/auth/session";
import { Brand } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { GithubBadge } from "@/components/marketing/github-badge";
import { cn } from "@/lib/utils";

/** Public chrome: a sticky translucent header and a quiet footer. The dashboard has its own shell. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [user, t] = await Promise.all([currentUser(), getTranslations("public")]);
  return (
    <>
      <header className="print-hide surface-glass sticky top-0 z-40 border-b border-border/70">
        <nav className="mx-auto grid h-28 max-w-6xl grid-cols-[1fr_auto] grid-rows-2 items-center gap-x-2 px-4 sm:px-6 md:flex md:h-16">
          <Link href="/" className="press col-start-1 row-start-1 w-fit shrink-0 rounded-md md:me-auto"><Brand /></Link>
          <div className="col-start-1 row-start-2 flex items-center gap-1 text-sm sm:gap-2">
            <Link href="/discover" className="press rounded-full px-3 py-2 hover:bg-muted/80">{t("nav.discover")}</Link>
            <Link href="/#pricing" className="press hidden rounded-full px-3 py-2 hover:bg-muted/80 sm:inline-flex">{t("nav.pricing")}</Link>
          </div>
          <div className="col-start-2 row-start-1 flex items-center justify-self-end gap-1">
            <LocaleSwitcher />
            <GithubBadge />
          </div>
          <div className="col-start-2 row-start-2 flex items-center justify-end gap-1 text-sm sm:gap-2">
            {/* the dashboard link is a plain <a> on purpose: analytics runs cookieless out here and identified in the dashboard (instrumentation-client.ts) */}
            {user ? (
              <a href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "pill" }))}>{t("nav.dashboard")}</a>
            ) : (
              <>
                <Link href="/login" className="press rounded-full px-3 py-2 hover:bg-muted/80">{t("nav.signIn")}</Link>
                <Link href="/login" className={cn(buttonVariants({ size: "pill" }), "shrink-0")}><span className="sm:hidden">{t("nav.hostShort")}</span><span className="hidden sm:inline">{t("nav.host")}</span></Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="print-hide mt-16 border-t border-border/70 py-10 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <Brand size="sm" className="text-foreground" />
            <p>{t("footer.tagline")}</p>
            <p>{t.rich("footer.credit", { inevent: (chunks) => <a href="https://inevent.com" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid">{chunks}</a> })}</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/discover" className="hover:text-foreground">{t("nav.discover")}</Link>
            <Link href="/login" className="hover:text-foreground">{t("nav.host")}</Link>
            <a href="/api/v1/docs" className="hover:text-foreground">{t("nav.api")}</a>
            <a href="https://evnelo.com" className="hover:text-foreground">evnelo.com</a>
          </div>
        </div>
      </footer>
    </>
  );
}
