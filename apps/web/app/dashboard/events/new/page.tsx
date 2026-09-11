import { requireOrg } from "@/lib/auth/session";
import { EventForm } from "@/components/dashboard/event-form";
import { storageConfigured } from "@/lib/storage";
import { PageHeader } from "@/components/dashboard/page-chrome";

export default async function NewEventPage() {
  const { org } = await requireOrg("edit_events", "/dashboard/events/new");
  return (
    <div>
      <PageHeader title="New event" description="Saved as a draft. Add tickets and questions, then publish when it's ready." />
      <div className="mt-7">
        <EventForm mode="create" organizationSlug={org.slug} uploadsEnabled={storageConfigured} defaults={{ feePassThrough: org.feePassThrough }} />
      </div>
    </div>
  );
}
