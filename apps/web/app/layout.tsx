import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { dirFor, type Locale } from "@/i18n/locales";
import { CaptchaProvider } from "@/components/captcha";
import { NavigationProgress } from "@/components/navigation-progress";
import { captchaPublicConfig } from "@/lib/captcha";
import { env } from "@/lib/env";
import "@fontsource-variable/instrument-sans/index.css"; // self-hosted: no Google Fonts dependency
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/caveat/600.css"; // handwritten notes on the marketing hero only
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.meta");
  return {
    // read per request: the Docker image is built without APP_URL, and without this every share-card URL says localhost
    metadataBase: new URL(env.APP_URL),
    title: { default: "Evnelo", template: "%s | Evnelo" },
    description: t("description"),
    applicationName: "Evnelo",
    openGraph: { siteName: "Evnelo", type: "website" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  return (
    <html lang={locale} dir={dirFor(locale)}>
      <body className="min-h-dvh flex flex-col">
        <NextIntlClientProvider>
          <Suspense fallback={null}><NavigationProgress /></Suspense>
          <CaptchaProvider config={captchaPublicConfig()}>{children}</CaptchaProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
