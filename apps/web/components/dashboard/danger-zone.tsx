"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/form-field";
import { deleteOrganizationAction } from "@/app/dashboard/actions";

export function DangerZone({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <section className="rounded-lg border border-destructive/40 p-4">
      <h2 className="font-medium">Data and deletion</h2>
      <p className="mt-1 text-sm text-muted-foreground">Download everything this organization owns as JSON (events, orders, attendees, check-ins, settings; no secrets). Deleting the organization cancels its events, revokes every ticket, erases all attendee personal data and disables API keys and webhooks. It cannot be undone.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Button asChild variant="outline"><a href="/dashboard/settings/export">Download all data</a></Button>
        {isOwner && (
          <form className="flex flex-wrap items-end gap-2" action={(fd) => start(async () => { const r = await deleteOrganizationAction(fd); if (r && !r.ok) setError(r.error); })}>
            <Field label={`Type ${slug} to confirm`} htmlFor="del-confirm"><Input id="del-confirm" name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></Field>
            <Button type="submit" variant="destructive" disabled={pending || confirm !== slug}>{pending ? "Deleting…" : "Delete organization"}</Button>
          </form>
        )}
      </div>
      <FormMessage error={error} />
    </section>
  );
}
