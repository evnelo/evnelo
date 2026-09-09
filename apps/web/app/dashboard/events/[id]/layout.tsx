import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireEvent, statusVariant } from "@/lib/dashboard";
import { Badge } from "@/components/ui/badge";
import { EventNav } from "@/components/dashboard/event-nav";

export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireEvent(id);
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground"><Link href="/dashboard" className="hover:underline">Events</Link> /</p>
          <h1 className="display mt-1 truncate text-3xl">{event.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Badge variant={statusVariant[event.status]}>{event.status}</Badge>
            <a href={`/e/${event.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">/e/{event.slug} <ExternalLink className="size-3.5" /></a>
          </div>
        </div>
      </div>
      <EventNav id={event.id} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
