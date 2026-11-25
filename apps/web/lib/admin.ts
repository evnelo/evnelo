import { notFound } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { adminEmails } from "@/lib/env";
import { isPlatformAdmin } from "@/lib/admin-emails";

/**
 * Gate for /admin: signed out goes to sign-in, signed in but not on ADMIN_EMAILS gets a 404, so the
 * pages' existence is not advertised. Call it at the top of every admin page and route.
 */
export async function requireAdmin(next = "/admin"): Promise<CurrentUser> {
  const user = await requireUser(next);
  if (!isPlatformAdmin(user.email, adminEmails)) notFound();
  return user;
}
