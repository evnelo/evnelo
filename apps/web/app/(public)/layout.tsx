import Link from "next/link";
import { currentUser } from "@/lib/auth/session";

/** Public chrome: header and footer for event pages, discovery, tickets and sign-in. The dashboard has its own. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <>
      <header className="border-b">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="font-display text-xl" style={{ fontVariationSettings: '"opsz" 24, "SOFT" 100' }}>
            OpenTicket
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/discover" className="hover:underline underline-offset-4">Discover</Link>
            {user ? (
              <Link href="/dashboard" className="rounded-md border px-3 py-1.5 hover:bg-muted">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="hover:underline underline-offset-4">Host an event</Link>
                <Link href="/login" className="rounded-md border px-3 py-1.5 hover:bg-muted">Sign in</Link>
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
