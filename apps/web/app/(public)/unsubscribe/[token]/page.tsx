import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { attendees, events } from "@ot/db";
import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/notifications/unsubscribe";
import { Button } from "@/components/ui/button";

export const metadata = { robots: "noindex,nofollow" };

export default async function UnsubscribePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const { done } = await searchParams;
  const attendeeId = verifyUnsubscribeToken(token);
  if (!attendeeId) notFound();
  const [row] = await db.select({ name: attendees.name, optOut: attendees.remindersOptOut, event: events.name, slug: events.slug })
    .from(attendees).innerJoin(events, eq(attendees.eventId, events.id)).where(eq(attendees.id, attendeeId)).limit(1);
  if (!row) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="display text-3xl">Reminders for {row.event}</h1>
      {row.optOut || done ? (
        <p className="mt-4 text-muted-foreground">Done. You won't get reminder messages for this event. Your ticket and any changes to the event still reach you.</p>
      ) : (
        <form method="post" action="/api/unsubscribe" className="mt-4 space-y-4">
          <input type="hidden" name="token" value={token} />
          <p className="text-muted-foreground">Stop reminder emails and texts for this event? Your ticket stays valid.</p>
          <Button type="submit" variant="event">Stop reminders</Button>
        </form>
      )}
      <p className="mt-6 text-sm"><a href={`/e/${row.slug}`} className="underline underline-offset-4">Back to the event</a></p>
    </div>
  );
}
