import Link from "next/link";
import { currentUser } from "@/lib/auth/session";

/** Public chrome: header and footer for event pages, discovery, tickets and sign-in. The dashboard has its own. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <>
      <header className="border-b">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="shrink-0 whitespace-nowrap font-display text-lg sm:text-xl" style={{ fontVariationSettings: '"opsz" 24, "SOFT" 100' }}>
            OpenTicket
          </Link>
          <div className="flex items-center gap-3 text-sm sm:gap-5">
            <Link href="/discover" className="hover:underline underline-offset-4">Discover</Link>
            {user ? (
              <Link href="/dashboard" className="rounded-md border px-3 py-1.5 hover:bg-muted">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="whitespace-nowrap hover:underline underline-offset-4"><span className="sm:hidden">Host</span><span className="hidden sm:inline">Host an event</span></Link>
                <Link href="/login" className="shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1.5 hover:bg-muted sm:px-3">Sign in</Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4">
          <span>Open source, self-host it or use the cloud.</span>
          <a href="https://github.com/openticket/openticket" className="hover:underline">GitHub</a>
        </div>
      </footer>
    </>
  );
}
