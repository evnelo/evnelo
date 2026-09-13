"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NarrowPage } from "@/components/narrow-page";
import { reportClientError } from "@/lib/report-client-error";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("public.error");
  const tc = useTranslations("common");
  useEffect(() => reportClientError(error), [error]);
  return (
    <NarrowPage
      brand
      align="center"
      icon={<TriangleAlert />}
      title={t("title")}
      description={
        <>
          {t("body")}
          {error.digest && <span className="mt-2 block font-mono text-xs">{t("reference", { digest: error.digest })}</span>}
        </>
      }
    >
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>{tc("actions.retry")}</Button>
        <Button asChild variant="outline" size="lg"><a href="/">{t("home")}</a></Button>
      </div>
    </NarrowPage>
  );
}
