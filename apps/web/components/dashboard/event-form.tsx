"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
type ManageT = ReturnType<typeof useTranslations<"manage">>;
type CommonT = ReturnType<typeof useTranslations<"common">>;

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
  const t = useTranslations("manage");
  const tc = useTranslations("common");
  const locale = useLocale();
  const browserTz = useMemo(() => (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"), []);
  const [v, setV] = useState<Values>(() => initial(defaults, browserTz));
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));
  useEffect(() => { if (!v.slugTouched && mode === "create") setV((s) => ({ ...s, slug: slugify(s.name) })); }, [v.name, v.slugTouched, mode]);

  // Unsaved work survives leaving the page: every change is mirrored to localStorage (debounced,
  // and flushed when the form unmounts), and on return a backup that differs from what the server
  // has is put straight back into the fields with a note and a way to discard it.
  const draftKey = `evnelo-event-draft:${organizationSlug}:${eventId ?? "new"}`;
  const baseline = useRef(JSON.stringify(initial(defaults, browserTz)));
  const dirty = JSON.stringify(v) !== baseline.current;
  const latest = useRef({ v, dirty });
  latest.current = { v, dirty };
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const writeBackup = (values: Values) => { try { localStorage.setItem(draftKey, JSON.stringify({ savedAt: new Date().toISOString(), values })); } catch {} };
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { savedAt: string; values: Values };
      if (JSON.stringify(parsed.values) === baseline.current) { localStorage.removeItem(draftKey); return; }
      setV(parsed.values);
      setRestoredAt(parsed.savedAt);
    } catch { /* corrupt or unavailable storage: start clean */ }
  }, [draftKey]);
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => writeBackup(v), 400);
    return () => window.clearTimeout(timer);
  }, [v, dirty, draftKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (latest.current.dirty) writeBackup(latest.current.v); }, [draftKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const forgetBackup = () => { try { localStorage.removeItem(draftKey); } catch {} setRestoredAt(null); };
  const discardRestored = () => { forgetBackup(); setV(initial(defaults, browserTz)); };

  const submit = () => {
    setMsg({});
    if (!v.startsLocal || !v.endsLocal) return setMsg({ error: t("eventForm.validation.times") });
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
      setMsg({ success: r.message ?? t("eventForm.saved") });
      router.refresh();
    });
  };

  const links = (list: Link[], onChange: (l: Link[]) => void) => (
    <div className="space-y-2">
      {list.map((l, i) => (
        <div key={i} className="flex gap-2">
          <div className="w-32 shrink-0"><Select value={l.platform} aria-label={t("eventForm.links.platform")} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, platform: e.target.value } : x)))}>{SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</Select></div>
          <Input type="url" value={l.url} placeholder="https://" aria-label={t("eventForm.links.url")} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
          <Button type="button" variant="ghost" size="icon" aria-label={t("eventForm.links.remove")} onClick={() => onChange(list.filter((_, j) => j !== i))}><X className="size-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...list, { platform: "website", url: "" }])}><Plus className="size-4" /> {t("eventForm.links.add")}</Button>
    </div>
  );

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="space-y-4 pb-28"
    >
      {restoredAt && (
        <Note className="flex flex-wrap items-center gap-x-4 gap-y-2 text-foreground">
          <History className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">{t("eventForm.restore.notice", { when: relativeTime(restoredAt, tc, locale) })}</span>
          <span className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={discardRestored}>{t("eventForm.restore.discard")}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRestoredAt(null)}>{tc("actions.ok")}</Button>
          </span>
        </Note>
      )}

      <Section title={t("eventForm.basics.title")} description={t("eventForm.basics.description")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("eventForm.basics.name")} htmlFor="name" className="sm:col-span-2"><Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} required maxLength={160} autoFocus={mode === "create"} /></Field>
          <Field label={t("eventForm.basics.url")} htmlFor="slug" help={publicEventPath(organizationSlug, v.slug || "…")} className="sm:col-span-2"><Input id="slug" value={v.slug} onChange={(e) => { set("slugTouched", true); set("slug", e.target.value); }} pattern="[a-z0-9\-]{3,80}" /></Field>
          <Field label={t("eventForm.basics.descriptionLabel")} htmlFor="desc" optional help={t("eventForm.basics.descriptionHelp")} className="sm:col-span-2"><Textarea id="desc" rows={6} value={v.descriptionMd} onChange={(e) => set("descriptionMd", e.target.value)} /></Field>
          <Field label={t("eventForm.basics.tags")} htmlFor="tags" optional help={t("eventForm.basics.tagsHelp")} className="sm:col-span-2"><Input id="tags" value={v.tags} onChange={(e) => set("tags", e.target.value)} placeholder={t("eventForm.basics.tagsPlaceholder")} /></Field>
          <div className="sm:col-span-2 grid gap-5 lg:grid-cols-[minmax(0,1fr)_10rem]">
            <ImageUploadField label={t("eventForm.basics.cover")} croppable value={v.coverImageUrl} onChange={(url) => set("coverImageUrl", url)} uploadsEnabled={uploadsEnabled} />
            <ImageUploadField label={t("eventForm.basics.logo")} value={v.logoUrl} onChange={(url) => set("logoUrl", url)} aspect="square" uploadsEnabled={uploadsEnabled} />
          </div>
        </div>
      </Section>

      <Section title={t("eventForm.when.title")} description={t("eventForm.when.description")}>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={t("eventForm.when.starts")} htmlFor="starts"><Input id="starts" type="datetime-local" value={v.startsLocal} onChange={(e) => set("startsLocal", e.target.value)} required /></Field>
          <Field label={t("eventForm.when.ends")} htmlFor="ends"><Input id="ends" type="datetime-local" value={v.endsLocal} onChange={(e) => set("endsLocal", e.target.value)} required /></Field>
          <Field label={t("eventForm.when.timezone")} htmlFor="tz"><Select id="tz" value={v.timezone} onChange={(e) => set("timezone", e.target.value)}>{TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}</Select></Field>
        </div>
        {status === "published" && <p className="hairline mt-4 pt-3 text-xs text-muted-foreground">{t("eventForm.when.publishedNote")}</p>}
      </Section>

      <Section title={t("eventForm.where.title")} description={t("eventForm.where.description")}>
        <div className="mb-5 inline-flex rounded-lg border border-border/80 bg-muted/40 p-0.5 text-sm">
          {(["in_person", "online", "hybrid"] as const).map((lt) => (
            <label key={lt} className={`press cursor-pointer rounded-md px-3 py-1.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)] ${v.locationType === lt ? "bg-card font-medium shadow-card" : "text-muted-foreground hover:text-foreground"}`}>
              <input type="radio" name="locationType" checked={v.locationType === lt} onChange={() => set("locationType", lt)} className="sr-only" />
              {t(`eventForm.where.locationType.${lt}`)}
            </label>
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {v.locationType !== "online" && (
            <>
              <Field label={t("eventForm.where.venue")} htmlFor="venue" className="sm:col-span-2"><Input id="venue" value={v.venueName} onChange={(e) => set("venueName", e.target.value)} placeholder={t("eventForm.where.venuePlaceholder")} /></Field>
              <Field label={t("eventForm.where.address")} htmlFor="address" className="sm:col-span-2" help={t("eventForm.where.addressHelp")}>
                <AddressAutocomplete
                  value={v.address}
                  onChange={(address) => set("address", address)}
                  onSelect={(suggestion) => setV((current) => ({ ...current, address: suggestion.address, city: suggestion.city, country: suggestion.country, lat: suggestion.lat, lng: suggestion.lng }))}
                />
              </Field>
              <Field label={t("eventForm.where.city")} htmlFor="city"><Input id="city" value={v.city} onChange={(e) => set("city", e.target.value)} /></Field>
              <Field label={t("eventForm.where.country")} htmlFor="country" help={t("eventForm.where.countryHelp")}><Input id="country" maxLength={2} value={v.country} onChange={(e) => set("country", e.target.value.toUpperCase())} placeholder={t("eventForm.where.countryPlaceholder")} /></Field>
              {v.lat && v.lng && <p className="text-xs text-muted-foreground sm:col-span-2">{t("eventForm.where.mapPin", { lat: Number(v.lat).toFixed(4), lng: Number(v.lng).toFixed(4) })}</p>}
            </>
          )}
          {v.locationType !== "in_person" && (
            <Field label={t("eventForm.where.joinLink")} htmlFor="online" help={t("eventForm.where.joinLinkHelp")} className="sm:col-span-2"><Input id="online" type="url" value={v.onlineUrl} onChange={(e) => set("onlineUrl", e.target.value)} placeholder={t("eventForm.where.joinLinkPlaceholder")} /></Field>
          )}
        </div>
      </Section>

      <Section title={t("eventForm.registration.title")} description={t("eventForm.registration.description")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("eventForm.registration.visibility")} htmlFor="vis" help={t(`eventForm.registration.visibilityHelp.${v.visibility}`)}>
            <Select id="vis" value={v.visibility} onChange={(e) => set("visibility", e.target.value as Values["visibility"])}>
              {(["public", "unlisted", "private"] as const).map((vis) => <option key={vis} value={vis}>{t(`eventForm.registration.visibilityOptions.${vis}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("eventForm.registration.capacity")} htmlFor="cap" optional help={t("eventForm.registration.capacityHelp")}><Input id="cap" type="number" min={1} value={v.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
        </div>
      </Section>

      <CollapsibleSection title={t("eventForm.options.title")} description={t("eventForm.options.description")} hint={optionsHint(v, t)} defaultOpen={Boolean(v.requiresApproval || v.collectPhone || v.guestsEnabled || v.waitlistEnabled || v.feePassThrough || v.refundPolicy)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Toggle label={t("eventForm.options.approval")} help={t("eventForm.options.approvalHelp")} checked={v.requiresApproval} onChange={(c) => set("requiresApproval", c)} />
          <Toggle label={t("eventForm.options.phone")} help={t("eventForm.options.phoneHelp")} checked={v.collectPhone} onChange={(c) => set("collectPhone", c)} />
          <Toggle label={t("eventForm.options.guests")} help={t("eventForm.options.guestsHelp")} checked={v.guestsEnabled} onChange={(c) => set("guestsEnabled", c)} />
          {v.guestsEnabled && <Field label={t("eventForm.options.maxGuests")} htmlFor="maxg"><Input id="maxg" type="number" min={1} max={20} value={v.maxGuests} onChange={(e) => set("maxGuests", Number(e.target.value) || 1)} /></Field>}
          <Toggle label={t("eventForm.options.waitlist")} help={t("eventForm.options.waitlistHelp")} checked={v.waitlistEnabled} onChange={(c) => set("waitlistEnabled", c)} />
          <Toggle label={t("eventForm.options.feePassThrough")} help={t("eventForm.options.feePassThroughHelp")} checked={v.feePassThrough} onChange={(c) => set("feePassThrough", c)} />
          <Field label={t("eventForm.options.refundPolicy")} htmlFor="refund" optional help={t("eventForm.options.refundPolicyHelp")} className="sm:col-span-2"><Textarea id="refund" rows={3} value={v.refundPolicy} onChange={(e) => set("refundPolicy", e.target.value)} /></Field>
        </div>
        <div className="hairline mt-5 pt-5">
          <p className="eyebrow">{t("eventForm.options.reminders")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.reminder24} onChange={(e) => set("reminder24", e.target.checked)} className="size-4 accent-[var(--primary)]" /> {t("eventForm.options.reminder24")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.reminder1} onChange={(e) => set("reminder1", e.target.checked)} className="size-4 accent-[var(--primary)]" /> {t("eventForm.options.reminder1")}</label>
            <label className="flex items-center gap-2">
              {t.rich("eventForm.options.reminderCustom", {
                input: () => <Input value={v.reminderCustom} onChange={(e) => set("reminderCustom", e.target.value)} placeholder={t("eventForm.options.reminderCustomPlaceholder")} className="h-8 w-24" aria-label={t("eventForm.options.reminderCustomLabel")} />,
              })}
            </label>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t("eventForm.links.title")} description={t("eventForm.links.description")} hint={t("eventForm.links.hint", { count: v.socialLinks.length })} defaultOpen={v.socialLinks.length > 0}>{links(v.socialLinks, (l) => set("socialLinks", l))}</CollapsibleSection>

      <CollapsibleSection title={t("eventForm.hosts.title")} description={t("eventForm.hosts.description")} hint={t("eventForm.hosts.hint", { count: v.hosts.length })} defaultOpen={v.hosts.length > 0}>
        <div className="space-y-3">
          {v.hosts.map((h, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border/80 bg-muted/25 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input value={h.name} placeholder={tc("labels.name")} aria-label={t("eventForm.hosts.name")} onChange={(e) => set("hosts", v.hosts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input value={h.title} placeholder={t("eventForm.hosts.titleField")} aria-label={t("eventForm.hosts.titleField")} onChange={(e) => set("hosts", v.hosts.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label={t("eventForm.hosts.remove")} onClick={() => set("hosts", v.hosts.filter((_, j) => j !== i))}><X className="size-4" /></Button>
              </div>
              <ImageUploadField label={t("eventForm.hosts.avatar")} aspect="avatar" uploadsEnabled={uploadsEnabled} value={h.avatarUrl} onChange={(url) => set("hosts", v.hosts.map((x, j) => (j === i ? { ...x, avatarUrl: url } : x)))} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set("hosts", [...v.hosts, { name: "", title: "", avatarUrl: "", socialLinks: [] }])}><Plus className="size-4" /> {t("eventForm.hosts.add")}</Button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t("eventForm.sponsors.title")} description={t("eventForm.sponsors.description")} hint={t("eventForm.sponsors.hint", { count: v.sponsors.length })} defaultOpen={v.sponsors.length > 0}>
        <div className="space-y-3">
          {v.sponsors.map((s, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border/80 bg-muted/25 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_8rem_1fr_auto]">
                <Input value={s.name} placeholder={tc("labels.name")} aria-label={t("eventForm.sponsors.name")} onChange={(e) => set("sponsors", v.sponsors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input value={s.tier} placeholder={t("eventForm.sponsors.tier")} aria-label={t("eventForm.sponsors.tier")} onChange={(e) => set("sponsors", v.sponsors.map((x, j) => (j === i ? { ...x, tier: e.target.value } : x)))} />
                <Input type="url" value={s.website} placeholder={t("eventForm.sponsors.website")} aria-label={t("eventForm.sponsors.website")} onChange={(e) => set("sponsors", v.sponsors.map((x, j) => (j === i ? { ...x, website: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label={t("eventForm.sponsors.remove")} onClick={() => set("sponsors", v.sponsors.filter((_, j) => j !== i))}><X className="size-4" /></Button>
              </div>
              <ImageUploadField label={t("eventForm.sponsors.logo")} aspect="thumb" uploadsEnabled={uploadsEnabled} value={s.logoUrl} onChange={(url) => set("sponsors", v.sponsors.map((x, j) => (j === i ? { ...x, logoUrl: url } : x)))} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set("sponsors", [...v.sponsors, { name: "", logoUrl: "", tier: "", website: "", socialLinks: [] }])}><Plus className="size-4" /> {t("eventForm.sponsors.add")}</Button>
        </div>
      </CollapsibleSection>

      <div className="surface-glass fixed inset-x-0 bottom-0 z-10 border-t border-border/80 px-4 sm:px-6 lg:start-64 lg:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 py-3">
          <div className="min-w-0 flex-1">
            {msg.error || msg.success
              ? <FormMessage error={msg.error} success={msg.success} />
              : <p className="truncate text-xs text-muted-foreground">{mode === "create" ? t("eventForm.bar.createNote") : t("eventForm.bar.editNote")}</p>}
          </div>
          <Button type="submit" size="lg" className="h-10 rounded-lg px-5 text-sm" pending={pending}>{mode === "create" ? t("eventForm.bar.createDraft") : t("eventForm.bar.saveChanges")}</Button>
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
        className="flex w-full items-center justify-between gap-4 rounded-xl p-5 text-start transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:p-6"
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

/** Closed-state summary of the options section: which switches are on and which reminders go out. */
function optionsHint(v: Values, t: ManageT) {
  const on = [
    v.requiresApproval && t("eventForm.options.hint.flags.approval"),
    v.collectPhone && t("eventForm.options.hint.flags.phone"),
    v.guestsEnabled && t("eventForm.options.hint.flags.guests"),
    v.waitlistEnabled && t("eventForm.options.hint.flags.waitlist"),
    v.feePassThrough && t("eventForm.options.hint.flags.feePassThrough"),
  ].filter(Boolean) as string[];
  const hours = [v.reminder24 && "24", v.reminder1 && "1", ...v.reminderCustom.split(/[,\s]+/).filter(Boolean)].filter(Boolean) as string[];
  const reminders = hours.map((h) => t("eventForm.options.hint.hours", { hours: h }));
  const first = on.length ? t("eventForm.options.hint.on", { items: on.join(", ") }) : t("eventForm.options.hint.defaults");
  const second = reminders.length ? t("eventForm.options.hint.reminders", { items: reminders.join(", ") }) : t("eventForm.options.hint.noReminders");
  return t("eventForm.options.hint.joined", { first, second });
}

function relativeTime(iso: string, tc: CommonT, locale: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return tc("time.momentAgo");
  if (minutes < 60) return tc("time.minutesAgo", { minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return tc("time.hoursAgo", { hours });
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function Toggle({ label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="press flex cursor-pointer items-start gap-3 rounded-lg border border-border/80 bg-muted/25 p-3 hover:bg-muted/50">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span><span className="block text-sm font-medium">{label}</span>{help && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{help}</span>}</span>
    </label>
  );
}
