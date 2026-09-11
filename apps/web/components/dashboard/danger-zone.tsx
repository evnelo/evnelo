"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/form-field";
import { SectionTray } from "@/components/dashboard/page-chrome";
import { deleteOrganizationAction } from "@/app/dashboard/actions";

export function DangerZone({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <SectionTray
      tone="destructive"
      title="Data and deletion"
      description="Download everything this organization owns as JSON — events, orders, attendees, check-ins, settings, no secrets. Deleting the organization cancels its events, revokes every ticket, erases all attendee personal data and disables API keys and webhooks. It cannot be undone."
      actions={<Button asChild variant="outline"><a href="/dashboard/settings/export"><Download className="size-4" /> Download all data</a></Button>}
    >
      {isOwner ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-card"
          action={(fd) => start(async () => { const r = await deleteOrganizationAction(fd); if (r && !r.ok) setError(r.error); })}
        >
          <div className="min-w-56 flex-1">
            <Field label={`Type ${slug} to confirm`} htmlFor="del-confirm"><Input id="del-confirm" name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" placeholder={slug} /></Field>
          </div>
          <Button type="submit" variant="destructive" disabled={pending || confirm !== slug}>{pending ? "Deleting…" : "Delete organization"}</Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Only the owner can delete this organization.</p>
      )}
      <div className="mt-3"><FormMessage error={error} /></div>
    </SectionTray>
  );
}
