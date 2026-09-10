"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X } from "lucide-react";
import { buildAnswersSchema, visibleFieldKeys, type Answers } from "@ot/core";
import type { RegistrationField, TicketType } from "@ot/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatMoney } from "@/lib/utils";

type Props = {
  eventId: string;
  ticketTypes: TicketType[];
  fields: RegistrationField[];
  collectPhone: boolean;
  guestsEnabled: boolean;
  maxGuests: number;
  onSubmitted?: (result: { orderId: string; clientSecret?: string; stripeAccountId?: string | null; holdExpiresAt?: string; resumeToken?: string; partySize: number }) => void;
};

/**
 * One registrant, one ticket type, optional +1s. Each guest becomes their own attendee
 * with their own ticket, at the same price as the host's ticket. Field visibility is
 * evaluated live from @ot/core and the same schema runs on the server.
 */
export function RegisterForm({ eventId, ticketTypes, fields, collectPhone, guestsEnabled, maxGuests, onSubmitted }: Props) {
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? "");
  const [answers, setAnswers] = useState<Answers>({});
  const [guestAnswers, setGuestAnswers] = useState<Answers[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const forTicket = (f: RegistrationField) => !f.ticketTypeIds || f.ticketTypeIds.includes(ticketTypeId);
  const attendeeFields = useMemo(() => fields.filter((f) => f.scope === "attendee" && forTicket(f)), [fields, ticketTypeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const orderFields = useMemo(() => fields.filter((f) => f.scope === "order"), [fields]);
  const guestFields = useMemo(() => fields.filter((f) => f.scope === "guest" && forTicket(f)), [fields, ticketTypeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = visibleFieldKeys([...attendeeFields, ...orderFields], answers);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, "Enter your name"),
        email: z.string().trim().email("Enter a valid email"),
        phone: collectPhone ? z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Use international format, e.g. +5511999999999").optional().or(z.literal("")) : z.string().optional(),
        smsOptIn: z.boolean().optional(),
        attendee: buildAnswersSchema(fields, { scope: "attendee", ticketTypeId }),
        order: buildAnswersSchema(fields, { scope: "order" }),
        guests: z.array(z.object({
          name: z.string().trim().min(1, "Enter your guest's name"),
          email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
          answers: buildAnswersSchema(fields, { scope: "guest", ticketTypeId }),
        })).max(maxGuests),
      }),
    [fields, ticketTypeId, collectPhone, maxGuests],
  );
  type Values = z.input<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", smsOptIn: false, attendee: {}, order: {}, guests: [] },
  });
  const guests = useFieldArray({ control: form.control, name: "guests" });

  const selected = ticketTypes.find((t) => t.id === ticketTypeId);
  const partySize = 1 + guests.fields.length;
  const totalMinor = (selected?.priceMinor ?? 0) * partySize;

  function addGuest() {
    guests.append({ name: "", email: "", answers: {} });
    setGuestAnswers((a) => [...a, {}]);
  }
  function removeGuest(i: number) {
    guests.remove(i);
    setGuestAnswers((a) => a.filter((_, j) => j !== i));
  }

  async function submit(values: Values) {
    setServerError(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, ticketTypeId, ...values }),
    });
    if (!res.ok) {
      setServerError((await res.json().catch(() => ({})))?.error ?? "Something went wrong. Try again.");
      return;
    }
    onSubmitted?.({ ...(await res.json()), partySize: 1 + values.guests.length });
  }

  const err = (path: string) => {
    const e = path.split(".").reduce<any>((o, k) => o?.[k], form.formState.errors);
    return e?.message ? <p className="mt-1 text-xs text-destructive">{String(e.message)}</p> : null;
  };

  /** Renders one custom field under `prefix` (e.g. "attendee", "guests.0.answers"), reporting answers to `update`. */
  function renderField(f: RegistrationField, prefix: string, isVisible: boolean, update: (key: string, value: unknown) => void) {
    if (!isVisible) return null;
    const name = `${prefix}.${f.key}` as any;
    const reg = form.register(name, {
      onChange: (e) => update(f.key, e.target.type === "checkbox" ? e.target.checked : e.target.value),
    });
    const label = (
      <Label htmlFor={name}>
        {f.label}
        {!f.required && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </Label>
    );
    const help = f.helpText && <p className="mt-1 text-xs text-muted-foreground">{f.helpText}</p>;
    switch (f.type) {
      case "long_text":
        return <div key={name}>{label}<Textarea id={name} placeholder={f.placeholder ?? undefined} className="mt-1.5" {...reg} />{help}{err(name)}</div>;
      case "select":
        return (
          <div key={name}>{label}
            <select id={name} className="mt-1.5 flex h-10 w-full rounded-md border bg-card px-3 text-sm" {...reg} defaultValue="">
              <option value="" disabled>Choose one</option>
              {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>{help}{err(name)}
          </div>
        );
      case "multi_select":
        return (
          <fieldset key={name}><legend className="text-sm font-medium">{f.label}{!f.required && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}</legend>
            <div className="mt-2 space-y-2">
              {(f.options ?? []).map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={o.value} className="size-4 accent-[var(--primary)]" {...form.register(name, {
                    onChange: () => update(f.key, form.getValues(name)),
                  })} />
                  {o.label}
                </label>
              ))}
            </div>{help}{err(name)}
          </fieldset>
        );
      case "checkbox":
      case "consent":
        return (
          <div key={name} className="flex items-start gap-2">
            <Checkbox id={name} onCheckedChange={(c) => { form.setValue(name, c === true, { shouldValidate: form.formState.isSubmitted }); update(f.key, c === true); }} />
            <Label htmlFor={name} className="leading-snug">{f.label}{!f.required && f.type === "checkbox" && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}</Label>
            {err(name)}
          </div>
        );
      default:
        return (
          <div key={name}>{label}
            <Input id={name} type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "url" ? "url" : f.type === "phone" ? "tel" : "text"} placeholder={f.placeholder ?? undefined} className="mt-1.5" {...reg} />
            {help}{err(name)}
          </div>
        );
    }
  }

  const updateHost = (key: string, value: unknown) => setAnswers((a) => ({ ...a, [key]: value }));
  const updateGuest = (i: number) => (key: string, value: unknown) => setGuestAnswers((all) => all.map((a, j) => (j === i ? { ...a, [key]: value } : a)));

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
      {ticketTypes.length > 1 && (
        <fieldset>
          <legend className="text-sm font-medium">Ticket</legend>
          <div className="mt-2 grid gap-2">
            {ticketTypes.map((t) => {
              const soldOut = t.quantity != null && t.sold + t.held >= t.quantity;
              return (
                <label key={t.id} className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2.5 text-sm has-[:checked]:border-event has-[:checked]:bg-accent ${soldOut ? "opacity-50" : ""}`}>
                  <span className="flex items-center gap-2">
                    <input type="radio" name="ticketType" value={t.id} checked={ticketTypeId === t.id} disabled={soldOut} onChange={() => setTicketTypeId(t.id)} className="accent-[var(--accent-event)]" />
                    {t.name}
                  </span>
                  <span className="tabular-nums">{soldOut ? "Sold out" : t.priceMinor === 0 ? "Free" : formatMoney(t.priceMinor, t.currency)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div><Label htmlFor="name">Name</Label><Input id="name" autoComplete="name" className="mt-1.5" {...form.register("name")} />{err("name")}</div>
      <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" className="mt-1.5" {...form.register("email")} />{err("email")}</div>
      {collectPhone && (
        <div>
          <Label htmlFor="phone">Phone <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="+5511999999999" className="mt-1.5" {...form.register("phone")} />
          {err("phone")}
          <label className="mt-2 flex items-start gap-2 text-sm">
            <Checkbox onCheckedChange={(c) => form.setValue("smsOptIn", c === true)} className="mt-0.5" />
            <span>Text me my ticket and a reminder before the event. Reply STOP to opt out.</span>
          </label>
        </div>
      )}

      {attendeeFields.map((f) => renderField(f, "attendee", visible.has(f.key), updateHost))}
      {orderFields.map((f) => renderField(f, "order", visible.has(f.key), updateHost))}

      {guestsEnabled && (
        <section className="space-y-4 border-t pt-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-medium">Guests</h3>
            <span className="text-xs text-muted-foreground">
              {guests.fields.length === 0 ? `Bring up to ${maxGuests} guest${maxGuests === 1 ? "" : "s"}` : `${guests.fields.length} of ${maxGuests}`}
              {selected && selected.priceMinor > 0 ? `, ${formatMoney(selected.priceMinor, selected.currency)} each` : ""}
            </span>
          </div>
          {guests.fields.map((g, i) => {
            const prefix = `guests.${i}`;
            const gVisible = visibleFieldKeys(guestFields, guestAnswers[i] ?? {});
            return (
              <div key={g.id} className="space-y-4 rounded-lg border bg-muted/40 p-4" data-testid={`guest-${i}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Guest {i + 1}</span>
                  <button type="button" onClick={() => removeGuest(i)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" aria-label={`Remove guest ${i + 1}`}>
                    <X className="size-3.5" /> Remove
                  </button>
                </div>
                <div><Label htmlFor={`${prefix}.name`}>Name</Label><Input id={`${prefix}.name`} className="mt-1.5" {...form.register(`guests.${i}.name`)} />{err(`${prefix}.name`)}</div>
                <div>
                  <Label htmlFor={`${prefix}.email`}>Email <span className="font-normal text-muted-foreground">(optional, we'll send their ticket to you otherwise)</span></Label>
                  <Input id={`${prefix}.email`} type="email" className="mt-1.5" {...form.register(`guests.${i}.email`)} />{err(`${prefix}.email`)}
                </div>
                {guestFields.map((f) => renderField(f, `${prefix}.answers`, gVisible.has(f.key), updateGuest(i)))}
              </div>
            );
          })}
          {guests.fields.length < maxGuests && (
            <Button type="button" variant="outline" size="sm" onClick={addGuest}>
              <Plus className="size-4" /> Add a guest
            </Button>
          )}
        </section>
      )}

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" variant="event" size="lg" className="w-full" disabled={form.formState.isSubmitting || !selected}>
        {totalMinor > 0
          ? `Continue to payment, ${formatMoney(totalMinor, selected!.currency)}${partySize > 1 ? ` for ${partySize}` : ""}`
          : partySize > 1 ? `Register ${partySize} people` : "Register"}
      </Button>
    </form>
  );
}
