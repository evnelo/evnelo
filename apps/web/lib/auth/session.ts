import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { can, type Action, type Role } from "@ot/core";
import { listMemberships } from "@ot/core/services";
import type { Organization } from "@ot/db";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const ORG_COOKIE = "ot_org";

export type CurrentUser = { id: string; email: string; name: string | null };

export async function currentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name ?? null };
}

/** Redirects to /login (with a return path) when signed out. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export type OrgContext = { user: CurrentUser; org: Organization; role: Role; memberships: { org: Organization; role: Role }[] };

/**
 * Signed-in user plus their current organization (cookie-selected, else first membership).
 * No memberships → onboarding. Missing permission → 403-style redirect to the dashboard home.
 */
export async function requireOrg(action?: Action, next?: string): Promise<OrgContext> {
  const user = await requireUser(next);
  const memberships = await listMemberships(db, user.id);
  if (!memberships.length) redirect("/onboarding");
  const wanted = (await cookies()).get(ORG_COOKIE)?.value;
  const current = memberships.find((m) => m.org.id === wanted) ?? memberships[0]!;
  if (action && !can(current.role, action)) redirect("/dashboard/no-access");
  return { user, org: current.org, role: current.role, memberships };
}
