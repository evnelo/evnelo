/**
 * Search-engine helpers: meta descriptions and schema.org structured data. Pure, so the shapes are unit
 * tested; pages serialize the results with `serializeJsonLd` from lib/urls.ts.
 */

type SeoEvent = {
  name: string;
  descriptionMd: string | null;
  startsAt: Date;
  endsAt: Date;
  status: "draft" | "published" | "cancelled" | "ended";
  locationType: string;
  venueName: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  coverImageUrl: string | null;
};
type SeoTicketType = { priceMinor: number; currency: string; quantity: number | null; sold: number; held: number; salesStartAt: Date | null };

/**
 * One line of plain text for `<meta name="description">`: markdown marks and links reduced to their text,
 * whitespace collapsed, cut at a word boundary so search results never end mid-word.
 */
export function metaDescription(text: string | null | undefined, max = 158): string | undefined {
  if (!text) return undefined;
  const plain = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+|^\s*[-*>]\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return undefined;
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, "")}…`;
}

/**
 * schema.org Event for a public event page, shaped for Google's event rich results: status, attendance
 * mode, a postal address, one Offer per visible ticket type with its real availability, and an image
 * (the cover, else the generated share card).
 */
export function eventStructuredData(input: { event: SeoEvent; organizer: { name: string; url: string }; ticketTypes: SeoTicketType[]; url: string; imageUrl: string; soldOut: boolean }) {
  const { event, organizer, ticketTypes, url, imageUrl, soldOut } = input;
  const online = event.locationType === "online";
  const hybrid = event.locationType === "hybrid";
  const place = {
    "@type": "Place",
    name: event.venueName ?? event.city ?? undefined,
    address: { "@type": "PostalAddress", streetAddress: event.address ?? undefined, addressLocality: event.city ?? undefined, addressCountry: event.country ?? undefined },
  };
  const virtual = { "@type": "VirtualLocation", url };
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    description: metaDescription(event.descriptionMd, 500),
    startDate: event.startsAt.toISOString(),
    endDate: event.endsAt.toISOString(),
    eventStatus: event.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: `https://schema.org/${online ? "Online" : hybrid ? "Mixed" : "Offline"}EventAttendanceMode`,
    location: online ? virtual : hybrid ? [place, virtual] : place,
    image: [event.coverImageUrl ?? imageUrl],
    url,
    organizer: { "@type": "Organization", name: organizer.name, url: organizer.url },
    offers: ticketTypes.map((t) => ({
      "@type": "Offer",
      url,
      price: (t.priceMinor / 100).toFixed(2),
      priceCurrency: t.currency,
      availability: soldOut || (t.quantity != null && t.sold + t.held >= t.quantity) ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      validFrom: t.salesStartAt?.toISOString(),
    })),
  };
}

/** The site itself, for the home page: who runs it, its name in search results, and what it is. */
export function siteStructuredData(appUrl: string, sameAs: string[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${appUrl}/#organization`, name: "Evnelo", url: `${appUrl}/`, logo: `${appUrl}/apple-icon`, sameAs },
      { "@type": "WebSite", "@id": `${appUrl}/#website`, name: "Evnelo", url: `${appUrl}/`, publisher: { "@id": `${appUrl}/#organization` } },
      {
        "@type": "SoftwareApplication",
        name: "Evnelo",
        url: `${appUrl}/`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "Open-source event ticketing and registration: free events are free, paid tickets cost 0.99%.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": `${appUrl}/#organization` },
      },
    ],
  };
}
