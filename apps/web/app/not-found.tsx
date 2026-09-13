import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NarrowPage } from "@/components/narrow-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.notFound");
  return { title: t("meta.title") };
}

export default async function NotFound() {
  const t = await getTranslations("public.notFound");
  return (
    <NarrowPage
      brand
      align="center"
      icon={<Compass />}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("body")}
    >
      <Link href="/discover" className={buttonVariants({ size: "lg" })}>{t("action")}</Link>
    </NarrowPage>
  );
}
