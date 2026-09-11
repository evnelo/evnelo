import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { Brand } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { GithubBadge } from "@/components/marketing/github-badge";
import { cn } from "@/lib/utils";

/** Public chrome: a sticky translucent header and a quiet footer. The dashboard has its own shell. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <>
      <header className="print-hide surface-glass sticky top-0 z-40 border-b border-border/70">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="press shrink-0 rounded-md"><Brand /></Link>
          <div className="flex items-center gap-1 text-sm sm:gap-2">
            <Link href="/discover" className="press rounded-full px-3 py-2 hover:bg-muted/80">Discover</Link>
            <Link href="/#pricing" className="press hidden rounded-full px-3 py-2 hover:bg-muted/80 sm:inline-flex">Pricing</Link>
            <GithubBadge className="hidden md:inline-flex" />
            {user ? (
              <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "pill" }))}>Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="press rounded-full px-3 py-2 hover:bg-muted/80">Sign in</Link>
                <Link href="/login" className={cn(buttonVariants({ size: "pill" }), "shrink-0")}><span className="sm:hidden">Host</span><span className="hidden sm:inline">Host an event</span></Link>
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
            <p>Events, in motion. Open event infrastructure: free events are free, paid events cost the host 0.99%.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/discover" className="hover:text-foreground">Discover</Link>
            <Link href="/login" className="hover:text-foreground">Host an event</Link>
            <a href="/api/v1/docs" className="hover:text-foreground">API</a>
            <a href="https://evnelo.com" className="hover:text-foreground">evnelo.com</a>
          </div>
        </div>
      </footer>
    </>
  );
}
