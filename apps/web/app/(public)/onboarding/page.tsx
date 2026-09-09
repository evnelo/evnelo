import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createOrganization, listMemberships, organizationInput } from "@ot/core/services";
import { slugify } from "@ot/core";
import { db } from "@/lib/db";
import { ORG_COOKIE, requireUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/form-field";

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
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="display text-4xl">Name your organization</h1>
      <p className="mt-3 text-sm text-muted-foreground">Events are published under an organization: a company, a community, or just you. You can invite teammates later.</p>
      {error && <div className="mt-4"><FormMessage error={error} /></div>}
      <form action={create} className="mt-6 space-y-4">
        <Field label="Organization name" htmlFor="name"><Input id="name" name="name" required minLength={2} maxLength={120} autoFocus /></Field>
        <Field label="Public URL" htmlFor="slug" help={`Your public page will live at /o/${suggested}. Lowercase letters, numbers and hyphens.`} optional>
          <Input id="slug" name="slug" pattern="[a-z0-9-]{3,60}" placeholder={suggested} />
        </Field>
        <Field label="Website" htmlFor="website" optional><Input id="website" name="website" type="url" placeholder="https://" /></Field>
        <Button type="submit" className="w-full">Create organization</Button>
      </form>
    </div>
  );
}
