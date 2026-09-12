"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, History, Plus, X } from "lucide-react";
import { SOCIAL_PLATFORMS, slugify } from "@evnelo/core";
import { TIMEZONES, utcToZonedLocal, zonedLocalToUtc } from "@/lib/tz";
import { publicEventPath } from "@/lib/urls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Note, SectionCard } from "@/components/dashboard/page-chrome";
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
    // the derived slug is part of the baseline, so an untouched form is not "dirty"
    name: d.name ?? "", slug: d.slug ?? slugify(d.name ?? ""), slugTouched: !!d.slug, descriptionMd: d.descriptionMd ?? "", coverImageUrl: d.coverImageUrl ?? "", logoUrl: d.logoUrl ?? "", timezone,
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

  // Unsaved work survives leaving the page: every change is mirrored to localStorage, and a
  // backup that differs from what the server has is offered back on return.
  const draftKey = `evnelo-event-draft:${organizationSlug}:${eventId ?? "new"}`;
  const baseline = useRef(JSON.stringify(initial(defaults, browserTz)));
  const dirty = JSON.stringify(v) !== baseline.current;
  const [backup, setBackup] = useState<{ savedAt: string; values: Values } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { savedAt: string; values: Values };
      if (JSON.stringify(parsed.values) === baseline.current) localStorage.removeItem(draftKey);
      else setBackup(parsed);
    } catch { /* corrupt or unavailable storage: start clean */ }
  }, [draftKey]);
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => { try { localStorage.setItem(draftKey, JSON.stringify({ savedAt: new Date().toISOString(), values: v })); } catch {} }, 400);
    return () => window.clearTimeout(timer);
  }, [v, dirty, draftKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const forgetBackup = () => { try { localStorage.removeItem(draftKey); } catch {} setBackup(null); };

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
      forgetBackup();
      baseline.current = JSON.stringify(v);
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
      className="space-y-4 pb-28"
    >
      {backup && !dirty && (
        <Note className="flex flex-wrap items-center gap-x-4 gap-y-2 text-foreground">
          <History className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">You have unsaved changes from {relativeTime(backup.savedAt)}.</span>
          <span className="flex gap-2">
            <Button type="button" size="sm" onClick={() => { setV(backup.values); setBackup(null); }}>Restore</Button>
            <Button type="button" size="sm" variant="ghost" onClick={forgetBackup}>Discard</Button>
          </span>
        </Note>
      )}

      <Section title="Basics" description="What people see first: the name, the address, the story, the artwork.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Event name" htmlFor="name" className="sm:col-span-2"><Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} required maxLength={160} autoFocus={mode === "create"} /></Field>
          <Field label="Event URL" htmlFor="slug" help={publicEventPath(organizationSlug, v.slug || "…")} className="sm:col-span-2"><Input id="slug" value={v.slug} onChange={(e) => { set("slugTouched", true); set("slug", e.target.value); }} pattern="[a-z0-9\-]{3,80}" /></Field>
          <Field label="Description" htmlFor="desc" optional help="Markdown is supported." className="sm:col-span-2"><Textarea id="desc" rows={6} value={v.descriptionMd} onChange={(e) => set("descriptionMd", e.target.value)} /></Field>
          <Field label="Tags" htmlFor="tags" optional help="Comma separated. Used for discovery." className="sm:col-span-2"><Input id="tags" value={v.tags} onChange={(e) => set("tags", e.target.value)} placeholder="design, meetup" /></Field>
          <div className="sm:col-span-2 grid gap-5 lg:grid-cols-[minmax(0,1fr)_10rem]">
            <ImageUploadField label="Cover image" croppable value={v.coverImageUrl} onChange={(url) => set("coverImageUrl", url)} uploadsEnabled={uploadsEnabled} />
            <ImageUploadField label="Event logo" value={v.logoUrl} onChange={(url) => set("logoUrl", url)} aspect="square" uploadsEnabled={uploadsEnabled} />
          </div>
        </div>
      </Section>

      <Section title="When" description="Times are stored in UTC and shown to everyone in the event's own zone.">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Starts" htmlFor="starts"><Input id="starts" type="datetime-local" value={v.startsLocal} onChange={(e) => set("startsLocal", e.target.value)} required /></Field>
          <Field label="Ends" htmlFor="ends"><Input id="ends" type="datetime-local" value={v.endsLocal} onChange={(e) => set("endsLocal", e.target.value)} required /></Field>
          <Field label="Time zone" htmlFor="tz"><Select id="tz" value={v.timezone} onChange={(e) => set("timezone", e.target.value)}>{TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}</Select></Field>
        </div>
        {status === "published" && <p className="hairline mt-4 pt-3 text-xs text-muted-foreground">Changing the time of a published event emails every attendee.</p>}
      </Section>

      <Section title="Where" description="Where people turn up, or the link they join.">
        <div className="mb-5 inline-flex rounded-lg border border-border/80 bg-muted/40 p-0.5 text-sm">
          {(["in_person", "online", "hybrid"] as const).map((t) => (
            <label key={t} className={`press cursor-pointer rounded-md px-3 py-1.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)] ${v.locationType === t ? "bg-card font-medium shadow-card" : "text-muted-foreground hover:text-foreground"}`}>
              <input type="radio" name="locationType" checked={v.locationType === t} onChange={() => set("locationType", t)} className="sr-only" />
              {t === "in_person" ? "In person" : t === "online" ? "Online" : "Hybrid"}
            </label>
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
              {v.lat && v.lng && <p className="text-xs text-muted-foreground sm:col-span-2">Map pin set from the address ({Number(v.lat).toFixed(4)}, {Number(v.lng).toFixed(4)}). Pick another suggestion to move it.</p>}
            </>
          )}
          {v.locationType !== "in_person" && (
            <Field label="Join link" htmlFor="online" help="Only shown to confirmed attendees, in their confirmation and reminders." className="sm:col-span-2"><Input id="online" type="url" value={v.onlineUrl} onChange={(e) => set("onlineUrl", e.target.value)} placeholder="https://meet…" /></Field>
          )}
        </div>
      </Section>

      <Section title="Registration" description="Who can find the event, and how many can come.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Visibility" htmlFor="vis" help={v.visibility === "public" ? "Listed on Discover and indexed by search engines." : v.visibility === "unlisted" ? "Anyone with the link; not listed or indexed." : "Only people with an invite link."}>
            <Select id="vis" value={v.visibility} onChange={(e) => set("visibility", e.target.value as Values["visibility"])}><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></Select>
          </Field>
          <Field label="Capacity" htmlFor="cap" optional help="Leave empty for unlimited."><Input id="cap" type="number" min={1} value={v.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
        </div>
      </Section>

      <CollapsibleSection title="Registration options" description="Approval, guests, reminders, fees and refund policy." hint={optionsHint(v)} defaultOpen={Boolean(v.requiresApproval || v.collectPhone || v.guestsEnabled || v.waitlistEnabled || v.feePassThrough || v.refundPolicy)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Toggle label="Approve each registration manually" help="People request to join; approve or reject them from Attendees." checked={v.requiresApproval} onChange={(c) => set("requiresApproval", c)} />
          <Toggle label="Ask for a phone number" help="Optional field with SMS opt-in for tickets and reminders." checked={v.collectPhone} onChange={(c) => set("collectPhone", c)} />
          <Toggle label="Allow guests (+1)" help="Each guest gets a separate ticket." checked={v.guestsEnabled} onChange={(c) => set("guestsEnabled", c)} />
          {v.guestsEnabled && <Field label="Max guests per registration" htmlFor="maxg"><Input id="maxg" type="number" min={1} max={20} value={v.maxGuests} onChange={(e) => set("maxGuests", Number(e.target.value) || 1)} /></Field>}
          <Toggle label="Waitlist when sold out" help="Visitors can queue; you offer spots from the Waitlist tab as seats free up." checked={v.waitlistEnabled} onChange={(c) => set("waitlistEnabled", c)} />
          <Toggle label="Buyer pays the service fee" help="Cloud edition: show the 0.99% as a line item." checked={v.feePassThrough} onChange={(c) => set("feePassThrough", c)} />
          <Field label="Refund policy" htmlFor="refund" optional help="Shown at checkout for paid tickets." className="sm:col-span-2"><Textarea id="refund" rows={3} value={v.refundPolicy} onChange={(e) => set("refundPolicy", e.target.value)} /></Field>
        </div>
        <div className="hairline mt-5 pt-5">
          <p className="eyebrow">Reminders</p>
          <div className="mt-2 flex flex-wrap items-center gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.reminder24} onChange={(e) => set("reminder24", e.target.checked)} className="size-4 accent-[var(--primary)]" /> 24 hours before</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.reminder1} onChange={(e) => set("reminder1", e.target.checked)} className="size-4 accent-[var(--primary)]" /> 1 hour before</label>
            <label className="flex items-center gap-2">Also <Input value={v.reminderCustom} onChange={(e) => set("reminderCustom", e.target.value)} placeholder="48, 3" className="h-8 w-24" aria-label="Custom reminder hours" /> hours before</label>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Links" description="Social links shown on the event page." hint={countHint(v.socialLinks.length, "link")} defaultOpen={v.socialLinks.length > 0}>{links(v.socialLinks, (l) => set("socialLinks", l))}</CollapsibleSection>

      <CollapsibleSection title="Hosts" description="People shown on the event page." hint={countHint(v.hosts.length, "host")} defaultOpen={v.hosts.length > 0}>
        <div className="space-y-3">
          {v.hosts.map((h, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border/80 bg-muted/25 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input value={h.name} placeholder="Name" aria-label="Host name" onChange={(e) => set("hosts", v.hosts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input value={h.title} placeholder="Title" aria-label="Host title" onChange={(e) => set("hosts", v.hosts.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove host" onClick={() => set("hosts", v.hosts.filter((_, j) => j !== i))}><X className="size-4" /></Button>
              </div>
              <ImageUploadField label="Avatar" aspect="avatar" uploadsEnabled={uploadsEnabled} value={h.avatarUrl} onChange={(url) => set("hosts", v.hosts.map((x, j) => (j === i ? { ...x, avatarUrl: url } : x)))} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set("hosts", [...v.hosts, { name: "", title: "", avatarUrl: "", socialLinks: [] }])}><Plus className="size-4" /> Add host</Button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Sponsors" description="Logos appear on the event page in this order." hint={countHint(v.sponsors.length, "sponsor")} defaultOpen={v.sponsors.length > 0}>
        <div className="space-y-3">
          {v.sponsors.map((s, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border/80 bg-muted/25 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_8rem_1fr_auto]">
                <Input value={s.name} placeholder="Name" aria-label="Sponsor name" onChange={(e) => set("sponsors", v.sponsors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input value={s.tier} placeholder="Tier" aria-label="Tier" onChange={(e) => set("sponsors", v.sponsors.map((x, j) => (j === i ? { ...x, tier: e.target.value } : x)))} />
                <Input type="url" value={s.website} placeholder="Website" aria-label="Website" onChange={(e) => set("sponsors", v.sponsors.map((x, j) => (j === i ? { ...x, website: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove sponsor" onClick={() => set("sponsors", v.sponsors.filter((_, j) => j !== i))}><X className="size-4" /></Button>
              </div>
              <ImageUploadField label="Logo" aspect="thumb" uploadsEnabled={uploadsEnabled} value={s.logoUrl} onChange={(url) => set("sponsors", v.sponsors.map((x, j) => (j === i ? { ...x, logoUrl: url } : x)))} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set("sponsors", [...v.sponsors, { name: "", logoUrl: "", tier: "", website: "", socialLinks: [] }])}><Plus className="size-4" /> Add sponsor</Button>
        </div>
      </CollapsibleSection>

      <div className="surface-glass fixed inset-x-0 bottom-0 z-10 border-t border-border/80 px-4 sm:px-6 lg:left-64 lg:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 py-3">
          <div className="min-w-0 flex-1">
            {msg.error || msg.success
              ? <FormMessage error={msg.error} success={msg.success} />
              : <p className="truncate text-xs text-muted-foreground">{mode === "create" ? "Nothing is public until you publish." : "Changes go live as soon as you save."}</p>}
          </div>
          <Button type="submit" size="lg" className="h-10 rounded-lg px-5 text-sm" pending={pending}>{mode === "create" ? "Create draft" : "Save changes"}</Button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <SectionCard title={title} description={description}>{children}</SectionCard>;
}

const SECTION_GRID = "grid gap-x-10 gap-y-5 md:grid-cols-[13.5rem_minmax(0,1fr)]";

/**
 * Same card and two-column rhythm as `Section`, folded away until needed. The header is one
 * button: title, a short hint of what is inside while closed, and a ringed chevron that turns.
 * The body animates open with a grid-row transition and is `inert` while closed, so hidden
 * fields are neither tabbable nor validated; a field that fails validation opens its section.
 */
function CollapsibleSection({ title, description, hint, children, defaultOpen = false }: { title: string; description?: string; hint?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="rounded-xl border border-border/80 bg-card text-card-foreground shadow-card" onInvalidCapture={() => setOpen(true)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="press flex w-full items-center justify-between gap-4 rounded-xl p-5 text-left transition-colors hover:bg-muted/40 sm:p-6"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className={`block text-sm leading-relaxed text-muted-foreground transition-opacity ${open ? "mt-1.5" : "mt-0.5"}`}>{open ? description : hint ?? description}</span>
        </span>
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-200 ${open ? "rotate-180 border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`} aria-hidden>
          <ChevronDown className="size-4" />
        </span>
      </button>
      <div id={id} inert={!open} className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className={`${SECTION_GRID} px-5 pb-5 sm:px-6 sm:pb-6`}>
            <span aria-hidden className="hidden md:block" />
            <div className="hairline min-w-0 pt-5 md:border-t-0 md:pt-0">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function countHint(n: number, noun: string) {
  return n === 0 ? `No ${noun}s yet` : `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function optionsHint(v: Values) {
  const on = [v.requiresApproval && "approval", v.collectPhone && "phone", v.guestsEnabled && "guests", v.waitlistEnabled && "waitlist", v.feePassThrough && "buyer pays fee"].filter(Boolean) as string[];
  const reminders = [v.reminder24 && "24h", v.reminder1 && "1h", ...v.reminderCustom.split(/[,\s]+/).filter(Boolean).map((h) => `${h}h`)].filter(Boolean) as string[];
  const parts = [on.length ? `On: ${on.join(", ")}` : "Defaults", reminders.length ? `reminders ${reminders.join(", ")}` : "no reminders"];
  return parts.join(" · ");
}

function relativeTime(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "a moment ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleString();
}

function Toggle({ label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="press flex cursor-pointer items-start gap-3 rounded-lg border border-border/80 bg-muted/25 p-3 hover:bg-muted/50">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span><span className="block text-sm font-medium">{label}</span>{help && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{help}</span>}</span>
    </label>
  );
}
