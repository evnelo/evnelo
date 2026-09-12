import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { dirFor, type Locale } from "@/i18n/locales";
import { CaptchaProvider } from "@/components/captcha";
import { NavigationProgress } from "@/components/navigation-progress";
import { captchaPublicConfig } from "@/lib/captcha";
import "@fontsource-variable/instrument-sans/index.css"; // self-hosted: no Google Fonts dependency
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/caveat/600.css"; // handwritten notes on the marketing hero only
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.meta");
  return {
    title: { default: "Evnelo", template: "%s | Evnelo" },
    description: t("description"),
    applicationName: "Evnelo",
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
