import type { Metadata } from "next";
import "@fontsource-variable/instrument-sans/index.css"; // self-hosted: no Google Fonts dependency
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Evnelo", template: "%s | Evnelo" },
  description: "Events, in motion. Open event infrastructure: publish events, register attendees, sell or give away tickets, message your community, check people in.",
  applicationName: "Evnelo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
