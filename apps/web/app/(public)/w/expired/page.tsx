import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Hourglass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NarrowPage } from "@/components/narrow-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("event");
  return { title: t("offerExpired.metaTitle"), robots: "noindex" };
}

export default async function OfferExpiredPage() {
  const t = await getTranslations("event");
  return (
    <NarrowPage
      icon={<Hourglass />}
      eyebrow={t("offerExpired.eyebrow")}
      title={t("offerExpired.title")}
      description={t("offerExpired.description")}
    >
      <Link href="/discover" className={buttonVariants({ variant: "outline", size: "lg" })}>{t("offerExpired.browse")}</Link>
    </NarrowPage>
  );
}
