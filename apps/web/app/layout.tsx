import type { Metadata } from "next";
import { Suspense } from "react";
import { CaptchaProvider } from "@/components/captcha";
import { NavigationProgress } from "@/components/navigation-progress";
import { captchaPublicConfig } from "@/lib/captcha";
import "@fontsource-variable/instrument-sans/index.css"; // self-hosted: no Google Fonts dependency
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/caveat/600.css"; // handwritten notes on the marketing hero only
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Evnelo", template: "%s | Evnelo" },
  description: "Events, in motion. Open event infrastructure: publish events, register attendees, sell or give away tickets, message your community, check people in.",
  applicationName: "Evnelo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh flex flex-col">
        <Suspense fallback={null}><NavigationProgress /></Suspense>
        <CaptchaProvider config={captchaPublicConfig()}>{children}</CaptchaProvider>
      </body>
    </html>
  );
}
