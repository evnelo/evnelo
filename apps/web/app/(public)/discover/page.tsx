import Link from "next/link";
import { listDiscoverableEvents } from "@/lib/queries/events";
import { publicEventPath } from "@/lib/urls";

export const revalidate = 300;

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city } = await searchParams;
  const list = await listDiscoverableEvents({ city });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="display text-5xl sm:text-6xl">{city ? `Events in ${city}` : "What's on"}</h1>
      <p className="mt-3 max-w-prose text-muted-foreground">Public events from every host on the platform. Free events are free to run; paid events cost the host 0.99%.</p>

      {list.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No upcoming public events yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Be the first: <Link href="/dashboard" className="underline underline-offset-4">host an event</Link>.</p>
        </div>
      ) : (
        <ul className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => {
            const d = new Date(e.startsAt);
            const when = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", timeZone: e.timezone }).format(d);
            return (
              <li key={e.id}>
                <Link href={publicEventPath(e.orgSlug, e.slug)} className="group block">
                  <div className="aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                    {e.coverImageUrl && <img src={e.coverImageUrl} alt="" className="size-full object-cover" loading="lazy" />}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{when}</p>
                  <h2 className="display mt-1 text-2xl group-hover:underline underline-offset-4" style={{ fontVariationSettings: '"opsz" 32, "SOFT" 50' }}>{e.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{e.orgName}{e.locationType === "online" ? ", online" : e.city ? `, ${e.city}` : ""}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
