"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CaptchaField, captchaTokenFrom } from "@/components/captcha";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Shown in place of the Register button when the event is sold out and has a waitlist. */
export function WaitlistJoin({ eventId, eventName }: { eventId: string; eventName: string }) {
  const t = useTranslations("event");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(undefined);
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, name, email, captchaToken: captchaTokenFrom(e.target) }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; already?: boolean };
      if (!res.ok) { setError(data.error ?? tc("errors.generic")); return; }
      setDone(data.already ? t("waitlist.already") : t("waitlist.joined"));
      setOpen(false);
    } catch { setError(tc("errors.network")); } finally { setBusy(false); }
  }

  if (done) return <p aria-live="polite" className="mt-4 rounded-lg bg-accent/70 px-3 py-3 text-sm text-accent-foreground">{done}</p>;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <p className="mt-4 text-sm text-muted-foreground">{t("waitlist.soldOut")}</p>
      <DialogTrigger asChild><Button variant="event" size="lg" className="mt-4 w-full">{t("waitlist.join")}</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>{eventName}</DialogTitle>
        <DialogDescription>{t("waitlist.description")}</DialogDescription>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div><Label htmlFor="wl-name">{tc("labels.name")}</Label><Input id="wl-name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11" /></div>
          <div><Label htmlFor="wl-email">{tc("labels.email")}</Label><Input id="wl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11" /></div>
          {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          <CaptchaField action="waitlist" />
          <Button type="submit" variant="event" size="lg" className="w-full" pending={busy}>{t("waitlist.join")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
