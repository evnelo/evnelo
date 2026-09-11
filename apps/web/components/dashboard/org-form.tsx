"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { normalizeWebsiteUrl, SOCIAL_PLATFORMS } from "@ot/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Field, FormMessage } from "@/components/ui/form-field";
import { ImageUploadField } from "@/components/dashboard/image-upload-field";
import { updateOrgAction } from "@/app/dashboard/actions";

type Values = { name: string; slug: string; website: string; logoUrl: string; accentColor: string; feePassThrough: boolean; socialLinks: { platform: string; url: string }[] };

export function OrgForm({ org, readOnly, uploadsEnabled }: { org: Values; readOnly: boolean; uploadsEnabled: boolean }) {
  const [v, setV] = useState<Values>(org);
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <form
      className="max-w-2xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateOrgAction({ ...v, socialLinks: v.socialLinks.filter((l) => l.url) });
          setMsg(r.ok ? { success: r.message } : { error: r.error });
        });
      }}
    >
      <fieldset disabled={readOnly || pending} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" htmlFor="org-name"><Input id="org-name" value={v.name} onChange={(e) => set("name", e.target.value)} required /></Field>
          <Field label="Public URL" htmlFor="org-slug" help="/o/…  Lowercase letters, numbers, hyphens."><Input id="org-slug" value={v.slug} onChange={(e) => set("slug", e.target.value)} pattern="[a-z0-9\-]{3,60}" /></Field>
          <Field label="Website" htmlFor="org-web" optional help="Enter example.com and we'll add https:// automatically."><Input id="org-web" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" value={v.website} onChange={(e) => set("website", e.target.value)} onBlur={() => set("website", normalizeWebsiteUrl(v.website))} placeholder="example.com" /></Field>
          <div>
            <ImageUploadField id="org-logo" label="Logo" aspect="thumb" uploadsEnabled={uploadsEnabled} value={v.logoUrl} onChange={(url) => set("logoUrl", url)} />
            <p className="mt-1.5 text-xs text-muted-foreground">Shown on event pages and emails.</p>
          </div>
          <Field label="Accent colour" htmlFor="org-accent" optional help="Buttons in emails and on ticket pages.">
            <div className="flex gap-2">
              <input type="color" aria-label="Pick colour" value={v.accentColor || "#16603a"} onChange={(e) => set("accentColor", e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border bg-card p-1" />
              <Input id="org-accent" value={v.accentColor} onChange={(e) => set("accentColor", e.target.value)} placeholder="#16603a" pattern="#[0-9a-fA-F]{6}" />
            </div>
          </Field>
          <Field label="Service fee" htmlFor="org-fee" help="Default for new events: pass the platform fee to the buyer as a line item, or absorb it.">
            <label className="flex h-9 items-center gap-2 text-sm"><Switch id="org-fee" checked={v.feePassThrough} onCheckedChange={(c) => set("feePassThrough", c)} /> Buyer pays the service fee</label>
          </Field>
        </div>

        <div>
          <p className="text-sm font-medium">Social links</p>
          <div className="mt-2 space-y-2">
            {v.socialLinks.map((l, i) => (
              <div key={i} className="flex gap-2">
                <div className="w-36"><Select value={l.platform} onChange={(e) => set("socialLinks", v.socialLinks.map((x, j) => (j === i ? { ...x, platform: e.target.value } : x)))} aria-label="Platform">{SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</Select></div>
                <Input type="url" value={l.url} onChange={(e) => set("socialLinks", v.socialLinks.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://" aria-label="URL" />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => set("socialLinks", v.socialLinks.filter((_, j) => j !== i))}><X className="size-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => set("socialLinks", [...v.socialLinks, { platform: "website", url: "" }])}><Plus className="size-4" /> Add link</Button>
          </div>
        </div>
      </fieldset>
      <FormMessage error={msg.error} success={msg.success} />
      {!readOnly && <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>}
    </form>
  );
}
