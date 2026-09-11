import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createOrganization, listMemberships, organizationInput } from "@evnelo/core/services";
import { slugify } from "@evnelo/core";
import { db } from "@/lib/db";
import { ORG_COOKIE, requireUser } from "@/lib/auth/session";
import { FormMessage } from "@/components/ui/form-field";
import { NarrowPage } from "@/components/narrow-page";
import { OnboardingForm } from "@/components/onboarding-form";

export const metadata = { title: "Set up your organization", robots: "noindex" };

/** First run: every event belongs to an organization, so the first sign-in creates one. */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser("/onboarding");
  if ((await listMemberships(db, user.id)).length) redirect("/dashboard");
  const { error } = await searchParams;

  async function create(formData: FormData) {
    "use server";
    const u = await requireUser("/onboarding");
    const parsed = organizationInput.safeParse({ name: formData.get("name"), slug: String(formData.get("slug") ?? "") || undefined, website: String(formData.get("website") ?? "") });
    if (!parsed.success) redirect(`/onboarding?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the form")}`);
    const org = await createOrganization(db, { ...parsed.data, ownerUserId: u.id });
    (await cookies()).set(ORG_COOKIE, org.id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 365 * 86400 });
    redirect("/dashboard");
  }

  const suggested = slugify(user.name ?? user.email.split("@")[0] ?? "my-org", 60);
  return (
    <NarrowPage
      eyebrow="First step"
      title="Name your organization"
      description="Events are published under an organization: a company, a community, or just you. You can invite teammates later."
    >
      {error && <div className="mb-4"><FormMessage error={error} /></div>}
      <OnboardingForm action={create} suggestedSlug={suggested} />
    </NarrowPage>
  );
}
