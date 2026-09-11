import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { BellOff } from "lucide-react";
import { attendees, events, organizations } from "@evnelo/db";
import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/notifications/unsubscribe";
import { Button } from "@/components/ui/button";
import { NarrowPage } from "@/components/narrow-page";
import { publicEventPath } from "@/lib/urls";

export const metadata = { robots: "noindex,nofollow" };

export default async function UnsubscribePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const { done } = await searchParams;
  const attendeeId = verifyUnsubscribeToken(token);
  if (!attendeeId) notFound();
  const [row] = await db.select({ name: attendees.name, optOut: attendees.remindersOptOut, event: events.name, slug: events.slug, organizationSlug: organizations.slug })
    .from(attendees)
    .innerJoin(events, eq(attendees.eventId, events.id))
    .innerJoin(organizations, eq(events.organizationId, organizations.id))
    .where(eq(attendees.id, attendeeId)).limit(1);
  if (!row) notFound();

  const stopped = row.optOut || done;
  return (
    <NarrowPage
      icon={<BellOff />}
      eyebrow="Reminders"
      title={`Reminders for ${row.event}`}
      description={stopped
        ? "Done. You won't get reminder messages for this event. Your ticket and any changes to the event still reach you."
        : "Stop reminder emails and texts for this event? Your ticket stays valid."}
    >
      <div className="flex flex-wrap items-center gap-3">
        {!stopped && (
          <form method="post" action="/api/unsubscribe">
            <input type="hidden" name="token" value={token} />
            <Button type="submit" variant="event" size="lg">Stop reminders</Button>
          </form>
        )}
        <Button asChild variant={stopped ? "default" : "outline"} size="lg"><a href={publicEventPath(row.organizationSlug, row.slug)}>Back to the event</a></Button>
      </div>
    </NarrowPage>
  );
}
