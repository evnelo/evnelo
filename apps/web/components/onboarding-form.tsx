"use client";

import { useState } from "react";
import { normalizeWebsiteUrl } from "@evnelo/core";
import { Button } from "@/components/ui/button";
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
  const [slug, setSlug] = useState("");
  const [website, setWebsite] = useState("");
  const preview = organizationSlugPreview(slug, suggestedSlug);

  return (
    <form action={action} className="space-y-5">
      <Field label="Organization name" htmlFor="name">
        <Input id="name" name="name" required minLength={2} maxLength={120} autoFocus />
      </Field>
      <Field
        label="Public URL"
        htmlFor="slug"
        help={`Your public page will live at ${preview}. Event pages will use /${slug || suggestedSlug}/event-slug. Lowercase letters, numbers and hyphens.`}
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
      <Field label="Website" htmlFor="website" help="You can enter adobe.com — we'll add https:// automatically." optional>
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
      <Button type="submit" className="w-full">Create organization</Button>
    </form>
  );
}
