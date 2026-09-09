import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { acceptInvite, getInvite } from "@ot/core/services";
import { ROLE_LABELS } from "@ot/core";
import { db } from "@/lib/db";
import { ORG_COOKIE, currentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-field";

export const metadata = { title: "Invitation", robots: "noindex" };

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const row = await getInvite(db, token);
  const user = await currentUser();

  async function accept() {
    "use server";
    const u = await currentUser();
    if (!u) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
    try {
      const orgId = await acceptInvite(db, token, u);
      (await cookies()).set(ORG_COOKIE, orgId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 365 * 86400 });
    } catch (e) {
      redirect(`/invite/${token}?error=${encodeURIComponent((e as Error).message)}`);
    }
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      {!row ? (
        <>
          <h1 className="display text-4xl">Invite not found</h1>
          <p className="mt-3 text-sm text-muted-foreground">This link isn't valid. Ask the person who invited you for a new one.</p>
        </>
      ) : (
        <>
          <h1 className="display text-4xl">Join {row.org.name}</h1>
          <p className="mt-3 text-sm text-muted-foreground">You've been invited to {row.org.name} as <strong>{ROLE_LABELS[row.invite.role]}</strong>. The invite was sent to {row.invite.email}.</p>
          {error && <div className="mt-4"><FormMessage error={error} /></div>}
          <div className="mt-6">
            {user ? (
              <form action={accept}><Button type="submit">Accept as {user.email}</Button></form>
            ) : (
              <Button asChild><a href={`/login?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(row.invite.email)}`}>Sign in to accept</a></Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
