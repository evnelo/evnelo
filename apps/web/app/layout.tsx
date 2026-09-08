import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import "@fontsource-variable/fraunces/full.css"; // self-hosted: no Google Fonts dependency
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OpenTicket", template: "%s | OpenTicket" },
  description: "Open-source event ticketing. Free events are free. Paid events cost 0.99%.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-dvh flex flex-col">
        <header className="border-b">
          <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="font-display text-xl" style={{ fontVariationSettings: '"opsz" 24, "SOFT" 100' }}>
              OpenTicket
            </Link>
            <div className="flex items-center gap-5 text-sm">
              <Link href="/discover" className="hover:underline underline-offset-4">Discover</Link>
              <Link href="/dashboard" className="hover:underline underline-offset-4">Host an event</Link>
              <Link href="/login" className="rounded-md border px-3 py-1.5 hover:bg-muted">Sign in</Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t py-8 text-sm text-muted-foreground">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4">
            <span>Open source, self-host it or use the cloud.</span>
            <Link href="/docs/api" className="hover:underline">API</Link>
            <Link href="/docs/mcp" className="hover:underline">MCP server</Link>
            <a href="https://github.com/openticket/openticket" className="hover:underline">GitHub</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
