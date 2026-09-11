import type { Event } from "@evnelo/db";

export function isDiscoverable(e: Pick<Event, "visibility" | "status" | "deletedAt">): boolean {
  return e.visibility === "public" && e.status === "published" && !e.deletedAt;
}

/** Robots directive for the public event page. */
export function robotsFor(e: Pick<Event, "visibility" | "status">): "index,follow" | "noindex,nofollow" {
  return e.visibility === "public" && e.status !== "draft" ? "index,follow" : "noindex,nofollow";
}

export function canView(
  e: Pick<Event, "visibility" | "status">,
  ctx: { isMember: boolean; hasInvite: boolean },
): boolean {
  if (ctx.isMember) return true;
  if (e.status === "draft") return false;
  if (e.visibility === "private") return ctx.hasInvite;
  return true; // public + unlisted are link-viewable
}
