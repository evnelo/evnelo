import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createOrganization, listMemberships, organizationInput } from "@evnelo/core/services";
import { slugify } from "@evnelo/core";
import { db } from "@/lib/db";
import { ORG_COOKIE, requireUser } from "@/lib/auth/session";
import { FormMessage } from "@/components/ui/form-field";
import { NarrowPage } from "@/components/narrow-page";
import { OnboardingForm } from "@/components/onboarding-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.onboarding");
  return { title: t("meta.title"), robots: "noindex" };
}

/** First run: every event belongs to an organization, so the first sign-in creates one. */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser("/onboarding");
  if ((await listMemberships(db, user.id)).length) redirect("/dashboard");
  const [{ error }, t] = await Promise.all([searchParams, getTranslations("auth.onboarding")]);

  async function create(formData: FormData) {
    "use server";
    const u = await requireUser("/onboarding");
    const parsed = organizationInput.safeParse({ name: formData.get("name"), slug: String(formData.get("slug") ?? "") || undefined, website: String(formData.get("website") ?? "") });
    if (!parsed.success) {
      const ta = await getTranslations("auth.onboarding");
      redirect(`/onboarding?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? ta("checkForm"))}`);
    }
    const org = await createOrganization(db, { ...parsed.data, ownerUserId: u.id });
    (await cookies()).set(ORG_COOKIE, org.id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 365 * 86400 });
    redirect("/dashboard");
  }

  const suggested = slugify(user.name ?? user.email.split("@")[0] ?? "my-org", 60);
  return (
    <NarrowPage
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      {error && <div className="mb-4"><FormMessage error={error} /></div>}
      <OnboardingForm action={create} suggestedSlug={suggested} />
    </NarrowPage>
  );
}
