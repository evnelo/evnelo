import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { MapPin, Video } from "lucide-react";
import { canView, robotsFor } from "@ot/core";
import { getPublicEventBySlug } from "@/lib/queries/events";
import { formatDateRange } from "@/lib/utils";
import { organizationPath, publicEventPath, serializeJsonLd } from "@/lib/urls";
import { SocialLinks } from "@/components/event/social-links";
import { RegisterCard } from "@/components/event/register-card";
import { env } from "@/lib/env";

type Params = { params: Promise<{ organizationSlug: string; eventSlug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { organizationSlug, eventSlug } = await params;
  const data = await getPublicEventBySlug(eventSlug, organizationSlug);
  if (!data || !canView(data.event, { isMember: false, hasInvite: false })) return {};
  const { event, org } = data;
  const canonical = `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`;
  return {
    title: event.name,
    description: event.descriptionMd?.slice(0, 160),
    robots: robotsFor(event),
    referrer: "no-referrer",
    alternates: { canonical },
    openGraph: { title: event.name, url: canonical, images: event.coverImageUrl ? [event.coverImageUrl] : [], siteName: org.name, type: "website" },
  };
}

export default async function EventPage({ params }: Params) {
  const { organizationSlug, eventSlug } = await params;
  const data = await getPublicEventBySlug(eventSlug, organizationSlug);
  if (!data) {
    // event slugs are globally unique: an org rename must not break links already sent in emails and tickets
    const moved = await getPublicEventBySlug(eventSlug);
    if (moved && canView(moved.event, { isMember: false, hasInvite: false })) permanentRedirect(publicEventPath(moved.org.slug, moved.event.slug));
    notFound();
  }
  const { event, org, hosts, sponsors, ticketTypes, fields, tags } = data;
  // TODO(auth): resolve session membership + invite token; until then private events are hidden
  if (!canView(event, { isMember: false, hasInvite: false })) notFound();

  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: event.timezone }).format(event.startsAt);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: event.timezone }).format(event.startsAt);
  const soldOut = ticketTypes.length > 0 && ticketTypes.every((t) => t.quantity != null && t.sold + t.held >= t.quantity);

  const eventPath = publicEventPath(org.slug, event.slug);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Event", name: event.name, startDate: event.startsAt.toISOString(), endDate: event.endsAt.toISOString(),
    image: event.coverImageUrl, url: `${env.APP_URL}${eventPath}`, organizer: { "@type": "Organization", name: org.name },
    eventAttendanceMode: event.locationType === "online" ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    location: event.locationType === "online" ? { "@type": "VirtualLocation", url: `${env.APP_URL}${eventPath}` } : { "@type": "Place", name: event.venueName, address: event.address },
    offers: ticketTypes.map((t) => ({ "@type": "Offer", price: (t.priceMinor / 100).toFixed(2), priceCurrency: t.currency, availability: "https://schema.org/InStock" })),
  };

  return (
    <article className="mx-auto max-w-6xl px-4 py-8">
      {event.visibility === "public" && event.status === "published" && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      )}

      {event.coverImageUrl && (
        <div className="aspect-[16/7] w-full overflow-hidden rounded-xl border bg-muted">
          <img src={event.coverImageUrl} alt="" className="size-full object-cover" />
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <div className="date-leaf shrink-0"><span>{month}</span><span>{day}</span></div>
            <div className="min-w-0">
              <h1 className="display text-4xl sm:text-5xl lg:text-6xl">{event.name}</h1>
              <p className="mt-3 text-muted-foreground">{formatDateRange(event.startsAt, event.endsAt, event.timezone)}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                {event.locationType === "online" ? <Video className="size-4" /> : <MapPin className="size-4" />}
                {event.locationType === "online" ? "Online, link shared after you register" : [event.venueName, event.city].filter(Boolean).join(", ")}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            {event.logoUrl ? <img src={event.logoUrl} alt="" className="size-9 rounded-md border object-contain" /> : org.logoUrl ? <img src={org.logoUrl} alt="" className="size-9 rounded-md border object-contain" /> : null}
            <div className="text-sm">
              <div>Hosted by <a href={organizationPath(org.slug)} className="font-medium hover:underline">{org.name}</a></div>
              {hosts.length > 0 && <div className="text-muted-foreground">{hosts.map((h) => h.name).join(", ")}</div>}
            </div>
          </div>

          {event.descriptionMd && (
            <section className="mt-10 max-w-prose whitespace-pre-line text-[15px] leading-7">{event.descriptionMd}</section>
          )}

          {event.locationType !== "online" && event.address && (
            <section className="mt-10">
              <h2 className="font-medium">Where</h2>
              <p className="mt-1 text-sm text-muted-foreground">{event.venueName}<br />{event.address}</p>
              {event.lat && event.lng && (
                <a className="mt-2 inline-block text-sm underline underline-offset-4" href={`https://www.google.com/maps?q=${event.lat},${event.lng}`} target="_blank" rel="noopener noreferrer">Open in maps</a>
              )}
            </section>
          )}

          {sponsors.length > 0 && (
            <section className="mt-10">
              <h2 className="font-medium">Sponsors</h2>
              <ul className="mt-4 flex flex-wrap items-center gap-x-10 gap-y-6">
                {sponsors.map((s) => (
                  <li key={s.id} className="flex flex-col items-start gap-1.5">
                    <a href={s.website ?? undefined} target="_blank" rel="noopener noreferrer" className="sponsor-logo">
                      {s.logoUrl ? <img src={s.logoUrl} alt={s.name} className="h-8 w-auto max-w-40 object-contain" /> : <span className="text-sm font-medium">{s.name}</span>}
                    </a>
                    {s.tier && <span className="text-xs text-muted-foreground">{s.tier}</span>}
                    <SocialLinks links={s.socialLinks} className="text-xs" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(tags.length > 0 || event.socialLinks.length > 0) && (
            <section className="mt-10 space-y-3">
              {tags.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {tags.map((t) => <li key={t.slug}><a href={`/discover?tag=${t.slug}`} className="rounded-full border px-3 py-1 text-xs hover:bg-muted">{t.name}</a></li>)}
                </ul>
              )}
              <SocialLinks links={event.socialLinks} />
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <RegisterCard eventId={event.id} eventName={event.name} ticketTypes={ticketTypes} fields={fields}
            collectPhone={event.collectPhone} requiresApproval={event.requiresApproval} soldOut={soldOut}
            guestsEnabled={event.guestsEnabled} maxGuests={event.maxGuests} stripePublishableKey={env.STRIPE_PUBLISHABLE_KEY} />
        </aside>
      </div>
    </article>
  );
}
