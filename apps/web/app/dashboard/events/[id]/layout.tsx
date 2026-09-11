import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { countAttendeesByStatus, countOpenWaitlist } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { requireEvent, statusVariant } from "@/lib/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EventNav } from "@/components/dashboard/event-nav";
import { DateLeaf } from "@/components/dashboard/page-chrome";
import { publicEventPath } from "@/lib/urls";

export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event, org } = await requireEvent(id);
  const eventPath = publicEventPath(org.slug, event.slug);
  const [counts, waitlist] = await Promise.all([countAttendeesByStatus(db, id), countOpenWaitlist(db, id)]);
  const attendees = (counts.confirmed ?? 0) + (counts.pending_approval ?? 0);

  return (
    <div>
      <Link href="/dashboard" className="press -ml-1 inline-flex items-center gap-1 rounded-md py-1 pr-2 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" aria-hidden /> All events
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-72 items-start gap-4">
          <DateLeaf date={event.startsAt} timezone={event.timezone} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h1 className="display text-3xl break-words">{event.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <Badge variant={statusVariant[event.status]}>{event.status}</Badge>
              <a href={eventPath} target="_blank" rel="noopener noreferrer" className="press inline-flex min-w-0 items-center gap-1 rounded text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground">
                <span className="truncate">{eventPath}</span>
              </a>
            </div>
          </div>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <a href={eventPath} target="_blank" rel="noopener noreferrer">View page <ExternalLink className="size-4" /></a>
        </Button>
      </div>
      <EventNav id={event.id} counts={{ attendees, waitlist }} />
      <div className="mt-7">{children}</div>
    </div>
  );
}
