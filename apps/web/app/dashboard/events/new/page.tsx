import { requireOrg } from "@/lib/auth/session";
import { EventForm } from "@/components/dashboard/event-form";

export default async function NewEventPage() {
  const { org } = await requireOrg("edit_events", "/dashboard/events/new");
  return (
    <div>
      <h1 className="display text-3xl">New event</h1>
      <p className="mt-1 text-sm text-muted-foreground">Saved as a draft. Add tickets and questions, then publish when it's ready.</p>
      <div className="mt-6">
        <EventForm mode="create" organizationSlug={org.slug} defaults={{ feePassThrough: org.feePassThrough }} />
      </div>
    </div>
  );
}
