import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MailQuestion, UserPlus } from "lucide-react";
import { acceptInvite, getInvite } from "@evnelo/core/services";
import { ROLE_LABELS } from "@evnelo/core";
import { db } from "@/lib/db";
import { ORG_COOKIE, currentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-field";
import { NarrowPage } from "@/components/narrow-page";

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

  if (!row) {
    return (
      <NarrowPage icon={<MailQuestion />} eyebrow="Invitation" title="Invite not found" description="This link isn't valid. Ask the person who invited you for a new one." />
    );
  }

  return (
    <NarrowPage
      icon={<UserPlus />}
      eyebrow="Invitation"
      title={`Join ${row.org.name}`}
      description={<>You've been invited to {row.org.name} as <strong className="text-foreground">{ROLE_LABELS[row.invite.role]}</strong>. The invite was sent to {row.invite.email}.</>}
    >
      {error && <div className="mb-4"><FormMessage error={error} /></div>}
      {user ? (
        <form action={accept}><Button type="submit" size="lg">Accept as {user.email}</Button></form>
      ) : (
        <Button asChild size="lg"><a href={`/login?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(row.invite.email)}`}>Sign in to accept</a></Button>
      )}
    </NarrowPage>
  );
}
