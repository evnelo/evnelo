import { listEventInvites } from "@evnelo/core/services";
import { can } from "@evnelo/core";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireEvent } from "@/lib/dashboard";
import { InvitesPanel } from "@/components/dashboard/invites-panel";

export default async function InvitesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, event } = await requireEvent(id);
  const invites = await listEventInvites(db, id);
  return (
    <InvitesPanel
      eventId={id}
      editable={can(role, "edit_events")}
      visibility={event.visibility}
      appUrl={env.APP_URL}
      invites={invites.map((i) => ({ id: i.id, token: i.token, email: i.email, maxUses: i.maxUses, uses: i.uses, expiresAt: i.expiresAt?.toISOString() ?? null, createdAt: i.createdAt.toISOString() }))}
    />
  );
}
