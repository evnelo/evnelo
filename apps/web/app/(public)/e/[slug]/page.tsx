import { notFound, permanentRedirect } from "next/navigation";
import { canView } from "@evnelo/core";
import { getPublicEventByLegacySlug } from "@/lib/queries/events";
import { publicEventPath } from "@/lib/urls";

/** Preserve existing event links while moving canonical pages under the organization slug. */
export default async function LegacyEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getPublicEventByLegacySlug((await params).slug);
  if (!data || !canView(data.event, { isMember: false, hasInvite: false })) notFound();
  permanentRedirect(publicEventPath(data.org.slug, data.event.slug));
}
