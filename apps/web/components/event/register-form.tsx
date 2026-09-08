"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { buildAnswersSchema, visibleFieldKeys } from "@ot/core";
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
  onSubmitted?: (result: { orderId: string; clientSecret?: string }) => void;
};

/**
 * One attendee, one ticket for v1 of the form (multi-quantity lands with checkout).
 * Field visibility is evaluated live from @ot/core, and the same schema runs on the server.
 */
export function RegisterForm({ eventId, ticketTypes, fields, collectPhone, onSubmitted }: Props) {
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? "");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const attendeeFields = useMemo(
    () => fields.filter((f) => f.scope === "attendee" && (!f.ticketTypeIds || f.ticketTypeIds.includes(ticketTypeId))),
    [fields, ticketTypeId],
  );
  const orderFields = useMemo(() => fields.filter((f) => f.scope === "order"), [fields]);
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
      }),
    [fields, ticketTypeId, collectPhone],
  );

  const form = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", smsOptIn: false, attendee: {}, order: {} },
  });

  const selected = ticketTypes.find((t) => t.id === ticketTypeId);
  const isPaid = (selected?.priceMinor ?? 0) > 0;

  async function submit(values: z.input<typeof schema>) {
    setServerError(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, ticketTypeId, quantity: 1, ...values }),
    });
    if (!res.ok) {
      setServerError((await res.json().catch(() => ({})))?.error ?? "Something went wrong. Try again.");
      return;
    }
    onSubmitted?.(await res.json());
  }

  const err = (path: string) => {
    const e = path.split(".").reduce<any>((o, k) => o?.[k], form.formState.errors);
    return e?.message ? <p className="mt-1 text-xs text-destructive">{String(e.message)}</p> : null;
  };

  function renderField(f: RegistrationField, scope: "attendee" | "order") {
    if (!visible.has(f.key)) return null;
    const name = `${scope}.${f.key}` as const;
    const reg = form.register(name, {
      onChange: (e) => setAnswers((a) => ({ ...a, [f.key]: e.target.type === "checkbox" ? e.target.checked : e.target.value })),
    });
    const label = (
      <Label htmlFor={name}>
        {f.label}
        {!f.required && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </Label>
    );
    switch (f.type) {
      case "long_text":
        return <div key={f.id}>{label}<Textarea id={name} placeholder={f.placeholder ?? undefined} className="mt-1.5" {...reg} />{f.helpText && <p className="mt-1 text-xs text-muted-foreground">{f.helpText}</p>}{err(name)}</div>;
      case "select":
        return (
          <div key={f.id}>{label}
            <select id={name} className="mt-1.5 flex h-10 w-full rounded-md border bg-card px-3 text-sm" {...reg} defaultValue="">
              <option value="" disabled>Choose one</option>
              {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>{err(name)}
          </div>
        );
      case "multi_select":
        return (
          <fieldset key={f.id}><legend className="text-sm font-medium">{f.label}</legend>
            <div className="mt-2 space-y-2">
              {(f.options ?? []).map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={o.value} className="size-4 accent-[var(--primary)]" {...form.register(name, {
                    onChange: () => setAnswers((a) => ({ ...a, [f.key]: form.getValues(name) })),
                  })} />
                  {o.label}
                </label>
              ))}
            </div>{err(name)}
          </fieldset>
        );
      case "checkbox":
      case "consent":
        return (
          <div key={f.id} className="flex items-start gap-2">
            <Checkbox id={name} onCheckedChange={(c) => { form.setValue(name, c === true, { shouldValidate: true }); setAnswers((a) => ({ ...a, [f.key]: c === true })); }} />
            <Label htmlFor={name} className="leading-snug">{f.label}</Label>
            {err(name)}
          </div>
        );
      default:
        return (
          <div key={f.id}>{label}
            <Input id={name} type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "url" ? "url" : f.type === "phone" ? "tel" : "text"} placeholder={f.placeholder ?? undefined} className="mt-1.5" {...reg} />
            {f.helpText && <p className="mt-1 text-xs text-muted-foreground">{f.helpText}</p>}{err(name)}
          </div>
        );
    }
  }

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

      {attendeeFields.map((f) => renderField(f, "attendee"))}
      {orderFields.map((f) => renderField(f, "order"))}

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" variant="event" size="lg" className="w-full" disabled={form.formState.isSubmitting || !selected}>
        {isPaid ? `Continue to payment, ${formatMoney(selected!.priceMinor, selected!.currency)}` : "Register"}
      </Button>
    </form>
  );
}
