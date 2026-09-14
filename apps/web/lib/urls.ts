export function organizationPath(organizationSlug: string) {
  return `/o/${organizationSlug}`;
}

export function organizationSlugPreview(slug: string, suggestedSlug: string) {
  return organizationPath(slug || suggestedSlug);
}

export function publicEventPath(organizationSlug: string, eventSlug: string) {
  return `/${organizationSlug}/${eventSlug}`;
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** The buyer's order page: every ticket in the order plus the receipt. Token is `orders.access_token`. */
export const orderPath = (accessToken: string) => `/orders/${accessToken}`;
