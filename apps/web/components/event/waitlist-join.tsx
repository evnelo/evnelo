"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Shown in place of the Register button when the event is sold out and has a waitlist. */
export function WaitlistJoin({ eventId, eventName }: { eventId: string; eventName: string }) {
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
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, name, email }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; already?: boolean };
      if (!res.ok) { setError(data.error ?? "Something went wrong. Try again."); return; }
      setDone(data.already ? "You're already on the waitlist. We'll email you if a spot opens up." : "You're on the waitlist. We'll email you a link to claim a spot if one opens up.");
      setOpen(false);
    } catch { setError("Network error. Try again."); } finally { setBusy(false); }
  }

  if (done) return <p aria-live="polite" className="mt-4 rounded-lg bg-accent/70 px-3 py-3 text-sm text-accent-foreground">{done}</p>;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <p className="mt-4 text-sm text-muted-foreground">Sold out. Join the waitlist and we&rsquo;ll email you if a spot opens up.</p>
      <DialogTrigger asChild><Button variant="event" size="lg" className="mt-4 w-full">Join the waitlist</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>{eventName}</DialogTitle>
        <DialogDescription>Leave your details and we&rsquo;ll email you a link to claim a spot if one opens up. Links are valid for 24 hours.</DialogDescription>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div><Label htmlFor="wl-name">Name</Label><Input id="wl-name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11" /></div>
          <div><Label htmlFor="wl-email">Email</Label><Input id="wl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11" /></div>
          {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="event" size="lg" className="w-full" disabled={busy}>{busy ? "Joining…" : "Join the waitlist"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
