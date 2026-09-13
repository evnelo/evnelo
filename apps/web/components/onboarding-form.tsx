"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { normalizeWebsiteUrl } from "@evnelo/core";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-field";
import { organizationSlugPreview } from "@/lib/urls";

export function OnboardingForm({
  action,
  suggestedSlug,
}: {
  action: (formData: FormData) => Promise<void>;
  suggestedSlug: string;
}) {
  const t = useTranslations("auth.onboarding.form");
  const [slug, setSlug] = useState("");
  const [website, setWebsite] = useState("");
  const preview = organizationSlugPreview(slug, suggestedSlug);

  return (
    <form action={action} className="space-y-5">
      <Field label={t("name")} htmlFor="name">
        <Input id="name" name="name" required minLength={2} maxLength={120} autoFocus />
      </Field>
      <Field
        label={t("slug")}
        htmlFor="slug"
        help={t("slugHelp", { preview, slug: slug || suggestedSlug })}
        optional
      >
        <Input
          id="slug"
          name="slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          pattern="[a-z0-9\-]{3,60}"
          placeholder={suggestedSlug}
        />
      </Field>
      <Field label={t("website")} htmlFor="website" help={t("websiteHelp")} optional>
        <Input
          id="website"
          name="website"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="adobe.com"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          onBlur={() => setWebsite(normalizeWebsiteUrl(website))}
        />
      </Field>
      <SubmitButton className="w-full">{t("submit")}</SubmitButton>
    </form>
  );
}
