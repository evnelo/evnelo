import { getTranslations } from "next-intl/server";
import { requireOrg } from "@/lib/auth/session";
import { EventForm } from "@/components/dashboard/event-form";
import { storageConfigured } from "@/lib/storage";
import { PageHeader } from "@/components/dashboard/page-chrome";

export default async function NewEventPage() {
  const [{ org }, t] = await Promise.all([requireOrg("edit_events", "/dashboard/events/new"), getTranslations("dashboard")]);
  return (
    <div>
      <PageHeader title={t("event.new.title")} description={t("event.new.description")} />
      <div className="mt-7">
        <EventForm mode="create" organizationSlug={org.slug} uploadsEnabled={storageConfigured} defaults={{ feePassThrough: org.feePassThrough }} />
      </div>
    </div>
  );
}
