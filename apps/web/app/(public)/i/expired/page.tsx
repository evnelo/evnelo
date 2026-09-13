import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MailX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NarrowPage } from "@/components/narrow-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("event");
  return { title: t("inviteExpired.metaTitle"), robots: "noindex" };
}

export default async function InviteExpiredPage() {
  const t = await getTranslations("event");
  return (
    <NarrowPage
      icon={<MailX />}
      eyebrow={t("inviteExpired.eyebrow")}
      title={t("inviteExpired.title")}
      description={t("inviteExpired.description")}
    >
      <Link href="/discover" className={buttonVariants({ variant: "outline", size: "lg" })}>{t("inviteExpired.browse")}</Link>
    </NarrowPage>
  );
}
