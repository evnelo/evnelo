import type { Metadata } from "next";
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
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
