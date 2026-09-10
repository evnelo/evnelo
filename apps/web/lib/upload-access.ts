import { cookies } from "next/headers";
import { can } from "@ot/core";
import { listMemberships } from "@ot/core/services";
import { db } from "@/lib/db";
import { currentUser, ORG_COOKIE } from "@/lib/auth/session";

export async function uploadAccess() {
  const user = await currentUser();
  if (!user) return { ok: false as const, status: 401, error: "Sign in to upload images." };
  const memberships = await listMemberships(db, user.id);
  const wanted = (await cookies()).get(ORG_COOKIE)?.value;
  const membership = memberships.find((item) => item.org.id === wanted) ?? memberships[0];
  if (!membership || !can(membership.role, "edit_events")) {
    return { ok: false as const, status: 403, error: "You do not have permission to upload images." };
  }
  return { ok: true as const, user, org: membership.org };
}
