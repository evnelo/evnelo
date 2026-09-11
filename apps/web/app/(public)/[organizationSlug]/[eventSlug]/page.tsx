import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowUpRight, Flag, Lock, MapPin, Video } from "lucide-react";
import { canView, robotsFor } from "@ot/core";
import { getPublicEvent, getPublicEventByLegacySlug } from "@/lib/queries/events";
import { cn, formatDateRange } from "@/lib/utils";
import { organizationPath, publicEventPath, serializeJsonLd } from "@/lib/urls";
import { SocialLinks } from "@/components/event/social-links";
import { RegisterCard } from "@/components/event/register-card";
import { env } from "@/lib/env";
import { eventAccess } from "@/lib/event-access";
import { waitlistOffer } from "@/lib/waitlist-access";
import { activeWaitlistHolds, liveAttendeeCount } from "@ot/core/services";
import { db } from "@/lib/db";

type Params = { params: Promise<{ organizationSlug: string; eventSlug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { organizationSlug, eventSlug } = await params;
  const data = await getPublicEvent(organizationSlug, eventSlug);
  if (!data) return {};
  const access = await eventAccess(data.event);
  if (!canView(data.event, { isMember: access.isMember, hasInvite: Boolean(access.invite) })) return {};
  const { event, org } = data;
  const canonical = `${env.APP_URL}${publicEventPath(org.slug, event.slug)}`;
  return {
    title: event.name,
    description: event.descriptionMd?.slice(0, 160),
    robots: robotsFor(event),
    referrer: "no-referrer",
    alternates: { canonical },
    // the share image comes from opengraph-image.tsx next to this page (cover + date + title), so no explicit images here
    openGraph: { title: event.name, url: canonical, siteName: org.name, type: "website" },
    twitter: { card: "summary_large_image", title: event.name, description: event.descriptionMd?.slice(0, 160) },
  };
}

/** Initials in a soft circle when there is no picture. */
function Avatar({ src, name, className }: { src: string | null; name: string; className?: string }) {
  if (src) return <img src={src} alt="" className={cn("size-12 rounded-full border border-border/80 bg-card object-cover", className)} />;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return (
    <span aria-hidden className={cn("flex size-12 shrink-0 items-center justify-center rounded-full bg-accent font-display text-lg text-accent-foreground", className)}>
      {initials}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="display text-2xl sm:text-3xl">{children}</h2>;
}

export default async function EventPage({ params }: Params) {
  const { organizationSlug, eventSlug } = await params;
  const data = await getPublicEvent(organizationSlug, eventSlug);
  if (!data) {
    // an organization rename must not break links already sent in emails and tickets
    const moved = await getPublicEventByLegacySlug(eventSlug);
    if (moved && canView(moved.event, { isMember: false, hasInvite: false })) permanentRedirect(publicEventPath(moved.org.slug, moved.event.slug));
    notFound();
  }
  const { event, org, hosts, sponsors, ticketTypes, fields, tags } = data;
  const access = await eventAccess(event);
  if (!canView(event, { isMember: access.isMember, hasInvite: Boolean(access.invite) })) notFound();

  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: event.timezone }).format(event.startsAt);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: event.timezone }).format(event.startsAt);
  const offer = event.waitlistEnabled ? await waitlistOffer(event.id) : null;
  const atCapacity = event.capacity != null && (await liveAttendeeCount(db, event.id)) + (await activeWaitlistHolds(db, event.id)) >= event.capacity;
  const soldOut = !offer && (atCapacity || (ticketTypes.length > 0 && ticketTypes.every((t) => t.quantity != null && t.sold + t.held >= t.quantity)));
  // an offer holds one seat in `held`; present that seat as available for its ticket type only
  const offeredTypes = offer ? ticketTypes.filter((t) => t.id === offer.ticketTypeId).map((t) => ({ ...t, held: Math.max(t.held - 1, 0) })) : ticketTypes;

  const eventPath = publicEventPath(org.slug, event.slug);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Event", name: event.name, startDate: event.startsAt.toISOString(), endDate: event.endsAt.toISOString(),
    image: event.coverImageUrl, url: `${env.APP_URL}${eventPath}`, organizer: { "@type": "Organization", name: org.name },
    eventAttendanceMode: event.locationType === "online" ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    location: event.locationType === "online" ? { "@type": "VirtualLocation", url: `${env.APP_URL}${eventPath}` } : { "@type": "Place", name: event.venueName, address: event.address },
    offers: ticketTypes.map((t) => ({ "@type": "Offer", price: (t.priceMinor / 100).toFixed(2), priceCurrency: t.currency, availability: "https://schema.org/InStock" })),
  };

  const online = event.locationType === "online";
  const format = online ? "Online" : event.locationType === "hybrid" ? "Hybrid" : "In person";
  const placeLine = online ? "Online, link shared after you register" : [event.venueName, event.city].filter(Boolean).join(", ");
  const hasCover = Boolean(event.coverImageUrl);
  const mapHref = event.lat && event.lng ? `https://www.google.com/maps?q=${event.lat},${event.lng}` : null;
  const orgLogo = event.logoUrl ?? org.logoUrl ?? null;

  return (
    <article>
      {event.visibility === "public" && event.status === "published" && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      )}

      {hasCover && (
        <div className="relative isolate aspect-[3/2] max-h-[36rem] w-full overflow-hidden bg-muted sm:aspect-[16/7]">
          <img src={event.coverImageUrl!} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="scrim absolute inset-0 opacity-80" aria-hidden />
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className={cn("relative z-10 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-y-0", hasCover ? "lg:-mt-28" : "pt-10 sm:pt-14")}>
            <header className={cn("animate-rise min-w-0 lg:col-start-1", hasCover && "pt-8 lg:-ml-8 lg:rounded-t-2xl lg:bg-background lg:px-8 lg:pt-8")}>
              <div className="flex items-start gap-5">
                <div className="date-leaf min-w-[4.25rem] shrink-0 [&>span:first-child]:text-sm [&>span:last-child]:py-2 [&>span:last-child]:text-4xl"><span>{month}</span><span>{day}</span></div>
                <div className="min-w-0">
                  <p className="eyebrow flex items-center gap-1.5">
                    {online ? <Video className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
                    {format}{event.city && !online ? ` · ${event.city}` : ""}
                  </p>
                  <h1 className="display mt-2 text-4xl sm:text-5xl lg:text-6xl">{event.name}</h1>
                </div>
              </div>
              <div className="mt-6 space-y-1">
                <p className="text-base sm:text-lg">{formatDateRange(event.startsAt, event.endsAt, event.timezone)}</p>
                <p className="text-sm text-muted-foreground">{placeLine}</p>
              </div>

              <div className="mt-6 flex items-center gap-3">
                {orgLogo ? <img src={orgLogo} alt="" className="size-10 rounded-full border border-border/80 bg-card object-contain" /> : <Avatar src={null} name={org.name} className="size-10 text-base" />}
                <div className="text-sm">
                  <div>Hosted by <a href={organizationPath(org.slug)} className="font-medium underline-offset-4 hover:underline">{org.name}</a></div>
                  {hosts.length > 0 && <div className="text-muted-foreground">{hosts.map((h) => h.name).join(", ")}</div>}
                </div>
              </div>
            </header>

          <aside className={cn("animate-rise lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24 lg:self-start", hasCover && "lg:pt-2")} style={{ ["--stagger" as string]: 2 }}>
            {event.visibility === "private" && (
              <p className="mb-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{access.invite ? `Private event. Your invitation${access.invite.email ? ` for ${access.invite.email}` : ""} is active.` : "Private event. You can see it because you help run it."}</span>
              </p>
            )}
            <RegisterCard eventId={event.id} eventName={event.name} ticketTypes={offeredTypes} fields={fields}
              collectPhone={event.collectPhone} requiresApproval={event.requiresApproval} soldOut={soldOut}
              guestsEnabled={event.guestsEnabled && !offer} maxGuests={event.maxGuests} stripePublishableKey={env.STRIPE_PUBLISHABLE_KEY}
              waitlist={{ enabled: event.waitlistEnabled, offer: offer ? { email: offer.email, expiresAt: offer.holdExpiresAt.toISOString(), ticketTypeName: offeredTypes[0]?.name ?? "" } : null }} />
          </aside>

          <div className="min-w-0 lg:col-start-1">
            {event.descriptionMd && (
              <section className="hairline mt-10 pt-8">
                <SectionTitle>About</SectionTitle>
                <div className="mt-4 max-w-prose whitespace-pre-line text-[15px] leading-7">{event.descriptionMd}</div>
              </section>
            )}

            {!online && event.address && (
              <section className="hairline mt-10 pt-8">
                <SectionTitle>Where</SectionTitle>
                {(() => {
                  const body = (
                    <>
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><MapPin className="size-5" aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        {event.venueName && <span className="block font-medium">{event.venueName}</span>}
                        <span className="block text-sm text-muted-foreground">{event.address}</span>
                      </span>
                      {mapHref && <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium">Open in maps <ArrowUpRight className="size-4" aria-hidden /></span>}
                    </>
                  );
                  const classes = "mt-4 flex items-center gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-card";
                  return mapHref
                    ? <a className={cn(classes, "lift press")} href={mapHref} target="_blank" rel="noopener noreferrer">{body}</a>
                    : <div className={classes}>{body}</div>;
                })()}
              </section>
            )}

            {hosts.length > 0 && (
              <section className="hairline mt-10 pt-8">
                <SectionTitle>Hosts</SectionTitle>
                <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                  {hosts.map((h) => (
                    <li key={h.id} className="flex items-center gap-4">
                      <Avatar src={h.avatarUrl} name={h.name} />
                      <div className="min-w-0">
                        <p className="font-medium">{h.name}</p>
                        {h.title && <p className="text-sm text-muted-foreground">{h.title}</p>}
                        <SocialLinks links={h.socialLinks} className="mt-1 text-xs" />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {sponsors.length > 0 && (
              <section className="hairline mt-10 pt-8">
                <SectionTitle>Sponsors</SectionTitle>
                <ul className="mt-5 flex flex-wrap items-stretch gap-3">
                  {sponsors.map((s) => (
                    <li key={s.id} className="flex min-w-40 flex-col justify-between gap-2 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-card">
                      <a href={s.website ?? undefined} target="_blank" rel="noopener noreferrer" className="sponsor-logo inline-flex min-h-8 items-center">
                        {s.logoUrl ? <img src={s.logoUrl} alt={s.name} className="h-8 w-auto max-w-40 object-contain" /> : <span className="font-display text-lg">{s.name}</span>}
                      </a>
                      <div className="flex flex-wrap items-center gap-x-3">
                        {s.tier && <span className="eyebrow">{s.tier}</span>}
                        <SocialLinks links={s.socialLinks} className="text-xs" />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(tags.length > 0 || event.socialLinks.length > 0) && (
              <section className="hairline mt-10 space-y-4 pt-8">
                {tags.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <li key={t.slug}>
                        <a href={`/discover?tag=${t.slug}`} className="press tap-area inline-flex h-9 items-center rounded-full border border-border bg-card px-3.5 text-[13px] font-medium hover:bg-muted">{t.name}</a>
                      </li>
                    ))}
                  </ul>
                )}
                <SocialLinks links={event.socialLinks} />
              </section>
            )}

            <p className="mt-12 text-xs text-muted-foreground">
              <a href={`/report?event=${event.id}`} className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-foreground"><Flag className="size-3" aria-hidden />Report this event</a>
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
