import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, isNull } from "drizzle-orm";
import { events, organizations } from "@ot/db";
import { db } from "@/lib/db";
import { SocialLinks } from "@/components/event/social-links";

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const [org] = await db.select().from(organizations).where(and(eq(organizations.slug, slug), isNull(organizations.deletedAt))).limit(1);
  if (!org) return null;
  const upcoming = await db.select().from(events)
    .where(and(eq(events.organizationId, org.id), eq(events.visibility, "public"), eq(events.status, "published"), isNull(events.deletedAt), gte(events.endsAt, new Date())))
    .orderBy(asc(events.startsAt)).limit(48);
  return { org, upcoming };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load((await params).slug);
  return data ? { title: data.org.name, description: `Events by ${data.org.name}` } : {};
}

export default async function OrgPage({ params }: Params) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const { org, upcoming } = data;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center gap-4">
        {org.logoUrl && <img src={org.logoUrl} alt="" className="size-14 rounded-lg border object-contain" />}
        <div>
          <h1 className="display text-4xl sm:text-5xl">{org.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
            {org.website && <a href={org.website} className="hover:underline" target="_blank" rel="noopener noreferrer">{org.website.replace(/^https?:\/\//, "")}</a>}
            <SocialLinks links={org.socialLinks} />
          </div>
        </div>
      </div>
      <h2 className="mt-10 text-sm font-medium text-muted-foreground">Upcoming events</h2>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing scheduled right now.</p>
      ) : (
        <ul className="mt-4 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((e) => {
            const when = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", timeZone: e.timezone }).format(e.startsAt);
            return (
              <li key={e.id}>
                <Link href={`/e/${e.slug}`} className="group block">
                  <div className="aspect-[4/3] overflow-hidden rounded-lg border bg-muted">{e.coverImageUrl && <img src={e.coverImageUrl} alt="" className="size-full object-cover" loading="lazy" />}</div>
                  <p className="mt-3 text-sm text-muted-foreground">{when}</p>
                  <h3 className="display mt-1 text-2xl group-hover:underline underline-offset-4" style={{ fontVariationSettings: '"opsz" 32, "SOFT" 50' }}>{e.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{e.locationType === "online" ? "Online" : e.city ?? e.venueName}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
