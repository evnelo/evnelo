"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, X } from "lucide-react";
import { SOCIAL_PLATFORMS, slugify } from "@ot/core";
import { TIMEZONES, utcToZonedLocal, zonedLocalToUtc } from "@/lib/tz";
import { publicEventPath } from "@/lib/urls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FormMessage } from "@/components/ui/form-field";
import { saveEventAction } from "@/app/dashboard/actions";
import { AddressAutocomplete } from "@/components/dashboard/address-autocomplete";
import { ImageUploadField } from "@/components/dashboard/image-upload-field";

type Link = { platform: string; url: string };
type Host = { name: string; title: string; avatarUrl: string; socialLinks: Link[] };
type Sponsor = { name: string; logoUrl: string; tier: string; website: string; socialLinks: Link[] };

export type EventDefaults = Partial<{
  name: string; slug: string; descriptionMd: string; coverImageUrl: string; logoUrl: string; timezone: string; startsAt: string; endsAt: string;
  locationType: "in_person" | "online" | "hybrid"; venueName: string; address: string; city: string; country: string; lat: string; lng: string; onlineUrl: string;
  visibility: "public" | "unlisted" | "private"; requiresApproval: boolean; capacity: number | null; waitlistEnabled: boolean; collectPhone: boolean;
  guestsEnabled: boolean; maxGuests: number; feePassThrough: boolean; refundPolicy: string; socialLinks: Link[]; reminderHours: number[]; tags: string[]; hosts: Host[]; sponsors: Sponsor[];
}>;

type Values = Required<Omit<EventDefaults, "startsAt" | "endsAt" | "capacity" | "reminderHours" | "tags">> & {
  startsLocal: string; endsLocal: string; capacity: string; reminder24: boolean; reminder1: boolean; reminderCustom: string; tags: string; slugTouched: boolean;
};

function initial(d: EventDefaults, tz: string): Values {
  const timezone = d.timezone ?? tz;
  return {
    name: d.name ?? "", slug: d.slug ?? "", slugTouched: !!d.slug, descriptionMd: d.descriptionMd ?? "", coverImageUrl: d.coverImageUrl ?? "", logoUrl: d.logoUrl ?? "", timezone,
    startsLocal: d.startsAt ? utcToZonedLocal(new Date(d.startsAt), timezone) : "", endsLocal: d.endsAt ? utcToZonedLocal(new Date(d.endsAt), timezone) : "",
    locationType: d.locationType ?? "in_person", venueName: d.venueName ?? "", address: d.address ?? "", city: d.city ?? "", country: d.country ?? "", lat: d.lat ?? "", lng: d.lng ?? "", onlineUrl: d.onlineUrl ?? "",
    visibility: d.visibility ?? "public", requiresApproval: d.requiresApproval ?? false, capacity: d.capacity ? String(d.capacity) : "", waitlistEnabled: d.waitlistEnabled ?? false, collectPhone: d.collectPhone ?? false,
    guestsEnabled: d.guestsEnabled ?? false, maxGuests: d.maxGuests ?? 1, feePassThrough: d.feePassThrough ?? false, refundPolicy: d.refundPolicy ?? "",
    socialLinks: d.socialLinks ?? [], reminder24: (d.reminderHours ?? [24, 1]).includes(24), reminder1: (d.reminderHours ?? [24, 1]).includes(1),
    reminderCustom: (d.reminderHours ?? []).filter((h) => h !== 24 && h !== 1).join(", "), tags: (d.tags ?? []).join(", "), hosts: d.hosts ?? [], sponsors: d.sponsors ?? [],
  };
}

export function EventForm({ mode, eventId, status, defaults, organizationSlug, uploadsEnabled }: { mode: "create" | "edit"; eventId?: string; status?: string; defaults: EventDefaults; organizationSlug: string; uploadsEnabled: boolean }) {
  const browserTz = useMemo(() => (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"), []);
  const [v, setV] = useState<Values>(() => initial(defaults, browserTz));
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));
  useEffect(() => { if (!v.slugTouched && mode === "create") setV((s) => ({ ...s, slug: slugify(s.name) })); }, [v.name, v.slugTouched, mode]);

  const submit = () => {
    setMsg({});
    if (!v.startsLocal || !v.endsLocal) return setMsg({ error: "Set a start and an end time." });
    const reminderHours = [...(v.reminder24 ? [24] : []), ...(v.reminder1 ? [1] : []), ...v.reminderCustom.split(/[,\s]+/).filter(Boolean).map(Number)];
    const payload = {
      name: v.name, slug: v.slug || undefined, descriptionMd: v.descriptionMd, coverImageUrl: v.coverImageUrl, logoUrl: v.logoUrl, timezone: v.timezone,
      startsAt: zonedLocalToUtc(v.startsLocal, v.timezone).toISOString(), endsAt: zonedLocalToUtc(v.endsLocal, v.timezone).toISOString(),
      locationType: v.locationType, venueName: v.venueName, address: v.address, city: v.city, country: v.country, lat: v.lat, lng: v.lng, onlineUrl: v.onlineUrl,
      visibility: v.visibility, requiresApproval: v.requiresApproval, capacity: v.capacity ? Number(v.capacity) : null, waitlistEnabled: v.waitlistEnabled, collectPhone: v.collectPhone,
      guestsEnabled: v.guestsEnabled, maxGuests: v.maxGuests, feePassThrough: v.feePassThrough, refundPolicy: v.refundPolicy,
      socialLinks: v.socialLinks.filter((l) => l.url), reminderHours, tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
      hosts: v.hosts.filter((h) => h.name), sponsors: v.sponsors.filter((s) => s.name),
    };
    start(async () => {
      const r = await saveEventAction(payload, eventId);
      if (!r.ok) return setMsg({ error: r.error });
      if (mode === "create" && r.id) return router.push(`/dashboard/events/${r.id}`);
      setMsg({ success: r.message ?? "Saved." });
      router.refresh();
    });
  };

  const links = (list: Link[], onChange: (l: Link[]) => void) => (
    <div className="space-y-2">
      {list.map((l, i) => (
        <div key={i} className="flex gap-2">
          <div className="w-32 shrink-0"><Select value={l.platform} aria-label="Platform" onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, platform: e.target.value } : x)))}>{SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</Select></div>
          <Input type="url" value={l.url} placeholder="https://" aria-label="URL" onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
          <Button type="button" variant="ghost" size="icon" aria-label="Remove link" onClick={() => onChange(list.filter((_, j) => j !== i))}><X className="size-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...list, { platform: "website", url: "" }])}><Plus className="size-4" /> Add link</Button>
    </div>
  );

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      // `invalid` doesn't bubble, so catch it in the capture phase and open the collapsed section that holds the field
      onInvalidCapture={(e) => { const details = (e.target as HTMLElement).closest("details"); if (details && !details.open) details.open = true; }}
      className="space-y-6 pb-24"
    >
      <Section title="Basics" description="The minimum details people need to recognize your event.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Event name" htmlFor="name" className="sm:col-span-2"><Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} required maxLength={160} autoFocus={mode === "create"} /></Field>
          <Field label="Event URL" htmlFor="slug" help={publicEventPath(organizationSlug, v.slug || "…")} className="sm:col-span-2"><Input id="slug" value={v.slug} onChange={(e) => { set("slugTouched", true); set("slug", e.target.value); }} pattern="[a-z0-9\-]{3,80}" /></Field>
        </div>
      </Section>

      <CollapsibleSection title="Details & images" description="Description, discovery tags, cover art and logo." defaultOpen={Boolean(v.descriptionMd || v.tags || v.coverImageUrl || v.logoUrl)}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Description" htmlFor="desc" optional help="Markdown is supported." className="sm:col-span-2"><Textarea id="desc" rows={6} value={v.descriptionMd} onChange={(e) => set("descriptionMd", e.target.value)} /></Field>
          <Field label="Tags" htmlFor="tags" optional help="Comma separated. Used for discovery." className="sm:col-span-2"><Input id="tags" value={v.tags} onChange={(e) => set("tags", e.target.value)} placeholder="design, meetup" /></Field>
          <div className="sm:col-span-2 grid gap-5 md:grid-cols-[minmax(0,1fr)_10rem]">
            <ImageUploadField label="Cover image" value={v.coverImageUrl} onChange={(url) => set("coverImageUrl", url)} uploadsEnabled={uploadsEnabled} />
            <ImageUploadField label="Event logo" value={v.logoUrl} onChange={(url) => set("logoUrl", url)} aspect="square" uploadsEnabled={uploadsEnabled} />
          </div>
        </div>
      </CollapsibleSection>

      <Section title="When">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Starts" htmlFor="starts"><Input id="starts" type="datetime-local" value={v.startsLocal} onChange={(e) => set("startsLocal", e.target.value)} required /></Field>
          <Field label="Ends" htmlFor="ends"><Input id="ends" type="datetime-local" value={v.endsLocal} onChange={(e) => set("endsLocal", e.target.value)} required /></Field>
          <Field label="Time zone" htmlFor="tz"><Select id="tz" value={v.timezone} onChange={(e) => set("timezone", e.target.value)}>{TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}</Select></Field>
        </div>
        {status === "published" && <p className="mt-3 text-xs text-muted-foreground">Changing the time of a published event emails every attendee.</p>}
      </Section>

      <Section title="Where">
        <div className="mb-4 flex gap-4 text-sm">
          {(["in_person", "online", "hybrid"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2"><input type="radio" name="locationType" checked={v.locationType === t} onChange={() => set("locationType", t)} className="accent-[var(--primary)]" /> {t === "in_person" ? "In person" : t === "online" ? "Online" : "Hybrid"}</label>
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {v.locationType !== "online" && (
            <>
              <Field label="Venue" htmlFor="venue" className="sm:col-span-2"><Input id="venue" value={v.venueName} onChange={(e) => set("venueName", e.target.value)} placeholder="Venue name" /></Field>
              <Field label="Address" htmlFor="address" className="sm:col-span-2" help="Pick a suggestion to fill city, country and map coordinates.">
                <AddressAutocomplete
                  value={v.address}
                  onChange={(address) => set("address", address)}
                  onSelect={(suggestion) => setV((current) => ({ ...current, address: suggestion.address, city: suggestion.city, country: suggestion.country, lat: suggestion.lat, lng: suggestion.lng }))}
                />
              </Field>
              <Field label="City" htmlFor="city"><Input id="city" value={v.city} onChange={(e) => set("city", e.target.value)} /></Field>
              <Field label="Country code" htmlFor="country" help="Two-letter code, e.g. BR"><Input id="country" maxLength={2} value={v.country} onChange={(e) => set("country", e.target.value.toUpperCase())} placeholder="US" /></Field>
              <Field label="Latitude" htmlFor="lat" optional help="Powers the map link. Filled in when you pick an address suggestion."><Input id="lat" value={v.lat} onChange={(e) => set("lat", e.target.value)} placeholder="-23.5578" /></Field>
              <Field label="Longitude" htmlFor="lng" optional><Input id="lng" value={v.lng} onChange={(e) => set("lng", e.target.value)} placeholder="-46.6606" /></Field>
            </>
          )}
          {v.locationType !== "in_person" && (
            <Field label="Join link" htmlFor="online" help="Only shown to confirmed attendees, in their confirmation and reminders." className="sm:col-span-2"><Input id="online" type="url" value={v.onlineUrl} onChange={(e) => set("onlineUrl", e.target.value)} placeholder="https://meet…" /></Field>
          )}
        </div>
      </Section>

      <Section title="Registration">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Visibility" htmlFor="vis" help={v.visibility === "public" ? "Listed on Discover and indexed by search engines." : v.visibility === "unlisted" ? "Anyone with the link; not listed or indexed." : "Only people with an invite link."}>
            <Select id="vis" value={v.visibility} onChange={(e) => set("visibility", e.target.value as Values["visibility"])}><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></Select>
          </Field>
          <Field label="Capacity" htmlFor="cap" optional help="Leave empty for unlimited."><Input id="cap" type="number" min={1} value={v.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
        </div>
      </Section>

      <CollapsibleSection title="Registration options" description="Approval, guests, reminders, fees and refund policy." defaultOpen={Boolean(v.requiresApproval || v.collectPhone || v.guestsEnabled || v.waitlistEnabled || v.feePassThrough || v.refundPolicy)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Toggle label="Approve each registration manually" help="People request to join; approve or reject them from Attendees." checked={v.requiresApproval} onChange={(c) => set("requiresApproval", c)} />
          <Toggle label="Ask for a phone number" help="Optional field with SMS opt-in for tickets and reminders." checked={v.collectPhone} onChange={(c) => set("collectPhone", c)} />
          <Toggle label="Allow guests (+1)" help="Each guest gets a separate ticket." checked={v.guestsEnabled} onChange={(c) => set("guestsEnabled", c)} />
          {v.guestsEnabled && <Field label="Max guests per registration" htmlFor="maxg"><Input id="maxg" type="number" min={1} max={20} value={v.maxGuests} onChange={(e) => set("maxGuests", Number(e.target.value) || 1)} /></Field>}
          <Toggle label="Waitlist when sold out" help="Coming soon." checked={v.waitlistEnabled} onChange={(c) => set("waitlistEnabled", c)} />
          <Toggle label="Buyer pays the service fee" help="Cloud edition: show the 0.99% as a line item." checked={v.feePassThrough} onChange={(c) => set("feePassThrough", c)} />
          <Field label="Refund policy" htmlFor="refund" optional help="Shown at checkout for paid tickets." className="sm:col-span-2"><Textarea id="refund" rows={3} value={v.refundPolicy} onChange={(e) => set("refundPolicy", e.target.value)} /></Field>
        </div>
        <div className="mt-5 border-t pt-5">
          <p className="text-sm font-medium">Reminders</p>
          <div className="mt-2 flex flex-wrap items-center gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.reminder24} onChange={(e) => set("reminder24", e.target.checked)} className="size-4 accent-[var(--primary)]" /> 24 hours before</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.reminder1} onChange={(e) => set("reminder1", e.target.checked)} className="size-4 accent-[var(--primary)]" /> 1 hour before</label>
            <label className="flex items-center gap-2">Also <Input value={v.reminderCustom} onChange={(e) => set("reminderCustom", e.target.value)} placeholder="48, 3" className="h-8 w-24" aria-label="Custom reminder hours" /> hours before</label>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Links" description="Social links shown on the event page." defaultOpen={v.socialLinks.length > 0}>{links(v.socialLinks, (l) => set("socialLinks", l))}</CollapsibleSection>

      <CollapsibleSection title="Hosts" description="People shown on the event page." defaultOpen={v.hosts.length > 0}>
        <div className="space-y-3">
          {v.hosts.map((h, i) => (
            <div key={i} className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Input value={h.name} placeholder="Name" aria-label="Host name" onChange={(e) => set("hosts", v.hosts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Input value={h.title} placeholder="Title" aria-label="Host title" onChange={(e) => set("hosts", v.hosts.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <Input type="url" value={h.avatarUrl} placeholder="Avatar URL" aria-label="Avatar URL" onChange={(e) => set("hosts", v.hosts.map((x, j) => (j === i ? { ...x, avatarUrl: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove host" onClick={() => set("hosts", v.hosts.filter((_, j) => j !== i))}><X className="size-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set("hosts", [...v.hosts, { name: "", title: "", avatarUrl: "", socialLinks: [] }])}><Plus className="size-4" /> Add host</Button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Sponsors" description="Logos appear on the event page in this order." defaultOpen={v.sponsors.length > 0}>
        <div className="space-y-3">
          {v.sponsors.map((s, i) => (
            <div key={i} className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_8rem_1fr_1fr_auto]">
              <Input value={s.name} placeholder="Name" aria-label="Sponsor name" onChange={(e) => set("sponsors", v.sponsors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Input value={s.tier} placeholder="Tier" aria-label="Tier" onChange={(e) => set("sponsors", v.sponsors.map((x, j) => (j === i ? { ...x, tier: e.target.value } : x)))} />
              <Input type="url" value={s.logoUrl} placeholder="Logo URL" aria-label="Logo URL" onChange={(e) => set("sponsors", v.sponsors.map((x, j) => (j === i ? { ...x, logoUrl: e.target.value } : x)))} />
              <Input type="url" value={s.website} placeholder="Website" aria-label="Website" onChange={(e) => set("sponsors", v.sponsors.map((x, j) => (j === i ? { ...x, website: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove sponsor" onClick={() => set("sponsors", v.sponsors.filter((_, j) => j !== i))}><X className="size-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set("sponsors", [...v.sponsors, { name: "", logoUrl: "", tier: "", website: "", socialLinks: [] }])}><Plus className="size-4" /> Add sponsor</Button>
        </div>
      </CollapsibleSection>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur lg:left-[15rem]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <div className="min-w-0 flex-1"><FormMessage error={msg.error} success={msg.success} /></div>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Create draft" : "Save changes"}</Button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function CollapsibleSection({ title, description, children, defaultOpen = false }: { title: string; description?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="group rounded-lg border bg-card text-card-foreground" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-medium">{title}</span>
          {description && <span className="mt-1 block text-sm text-muted-foreground">{description}</span>}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t p-4">{children}</div>
    </details>
  );
}

function Toggle({ label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-md border p-3">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span><span className="block text-sm font-medium">{label}</span>{help && <span className="block text-xs text-muted-foreground">{help}</span>}</span>
    </label>
  );
}
