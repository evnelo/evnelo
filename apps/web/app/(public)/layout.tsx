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
        <nav className="mx-auto grid h-28 max-w-6xl grid-cols-[1fr_auto] grid-rows-2 items-center gap-x-2 px-4 sm:px-6 md:flex md:h-16">
          <Link href="/" className="press col-start-1 row-start-1 w-fit shrink-0 rounded-md md:mr-auto"><Brand /></Link>
          <div className="col-start-1 row-start-2 flex items-center gap-1 text-sm sm:gap-2">
            <Link href="/discover" className="press rounded-full px-3 py-2 hover:bg-muted/80">Discover</Link>
            <Link href="/#pricing" className="press hidden rounded-full px-3 py-2 hover:bg-muted/80 sm:inline-flex">Pricing</Link>
          </div>
          <GithubBadge className="col-start-2 row-start-1 justify-self-end" />
          <div className="col-start-2 row-start-2 flex items-center justify-end gap-1 text-sm sm:gap-2">
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
            <p>Brought to you by <a href="https://inevent.com" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid">InEvent</a>.</p>
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
