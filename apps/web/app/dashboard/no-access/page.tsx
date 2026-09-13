import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/dashboard/page-chrome";

export default async function NoAccessPage() {
  const t = await getTranslations("dashboard");
  return (
    <div>
      <PageHeader title={t("noAccess.title")} description={t("noAccess.description")} />
      <EmptyState
        className="mt-10"
        icon={Lock}
        title={t("noAccess.empty.title")}
        description={t("noAccess.empty.description")}
      />
    </div>
  );
}
