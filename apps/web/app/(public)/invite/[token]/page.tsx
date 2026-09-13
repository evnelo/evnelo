import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MailQuestion, UserPlus } from "lucide-react";
import { acceptInvite, getInvite } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { ORG_COOKIE, currentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-field";
import { NarrowPage } from "@/components/narrow-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.invite");
  return { title: t("meta.title"), robots: "noindex" };
}

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const [row, user, t] = await Promise.all([getInvite(db, token), currentUser(), getTranslations("auth.invite")]);

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
      <NarrowPage icon={<MailQuestion />} eyebrow={t("eyebrow")} title={t("notFound.title")} description={t("notFound.description")} />
    );
  }

  return (
    <NarrowPage
      icon={<UserPlus />}
      eyebrow={t("eyebrow")}
      title={t("title", { org: row.org.name })}
      description={t.rich("description", { org: row.org.name, role: t(`roles.${row.invite.role}`), email: row.invite.email, b: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
    >
      {error && <div className="mb-4"><FormMessage error={error} /></div>}
      {user ? (
        <form action={accept}><SubmitButton size="lg">{t("accept", { email: user.email })}</SubmitButton></form>
      ) : (
        <Button asChild size="lg"><a href={`/login?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(row.invite.email)}`}>{t("signIn")}</a></Button>
      )}
    </NarrowPage>
  );
}
