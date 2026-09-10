import { getEventWithRelations } from "@ot/core/services";
import { db } from "@/lib/db";
import { requireEvent } from "@/lib/dashboard";
import { EventForm } from "@/components/dashboard/event-form";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireEvent(id, "edit_events");
  const data = (await getEventWithRelations(db, id))!;
  const e = data.event;
  return (
    <EventForm
      mode="edit"
      eventId={id}
      organizationSlug={org.slug}
      status={e.status}
      defaults={{
        name: e.name, slug: e.slug, descriptionMd: e.descriptionMd ?? "", coverImageUrl: e.coverImageUrl ?? "", logoUrl: e.logoUrl ?? "",
        timezone: e.timezone, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(),
        locationType: e.locationType, venueName: e.venueName ?? "", address: e.address ?? "", city: e.city ?? "", country: e.country ?? "", lat: e.lat ?? "", lng: e.lng ?? "", onlineUrl: e.onlineUrl ?? "",
        visibility: e.visibility, requiresApproval: e.requiresApproval, capacity: e.capacity, waitlistEnabled: e.waitlistEnabled, collectPhone: e.collectPhone,
        guestsEnabled: e.guestsEnabled, maxGuests: e.maxGuests, feePassThrough: e.feePassThrough, refundPolicy: e.refundPolicy ?? "",
        socialLinks: e.socialLinks, reminderHours: e.reminderHours, tags: data.tags.map((t) => t.name),
        hosts: data.hosts.map((h) => ({ name: h.name, title: h.title ?? "", avatarUrl: h.avatarUrl ?? "", socialLinks: h.socialLinks })),
        sponsors: data.sponsors.map((s) => ({ name: s.name, logoUrl: s.logoUrl ?? "", tier: s.tier ?? "", website: s.website ?? "", socialLinks: s.socialLinks })),
      }}
    />
  );
}
