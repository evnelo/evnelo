import * as React from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Flag } from "lucide-react";
import { createEventReport, eventReportInput } from "@ot/core/services";
import { events, organizations } from "@ot/db";
import { db } from "@/lib/db";
import { emailConfigured, env } from "@/lib/env";
import { clientAddressFromHeaders } from "@/lib/api-http";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { captureError } from "@/lib/observability";
import { renderEmail, sendEmail } from "@/lib/email";
import { publicEventPath } from "@/lib/urls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form-field";
import { NarrowPage } from "@/components/narrow-page";
import AbuseReport, { abuseReportSubject } from "@/emails/abuse-report";

export const metadata = { title: "Report an event", robots: "noindex,nofollow" };

const REASONS: Record<string, string> = { spam: "Spam or misleading", scam: "Scam or fraud", inappropriate: "Inappropriate content", copyright: "Copyright or trademark", other: "Something else" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ event?: string; sent?: string; error?: string }> }) {
  const { event: eventId, sent, error } = await searchParams;
  const [row] = eventId && eventId.length === 26
    ? await db.select({ id: events.id, name: events.name, slug: events.slug, orgSlug: organizations.slug, orgName: organizations.name }).from(events).innerJoin(organizations, eq(organizations.id, events.organizationId)).where(eq(events.id, eventId)).limit(1)
    : [];

  async function submit(formData: FormData) {
    "use server";
    const parsed = eventReportInput.safeParse({ eventId: formData.get("eventId"), reason: formData.get("reason"), details: formData.get("details") ?? "", reporterEmail: formData.get("reporterEmail") ?? "" });
    if (!parsed.success) redirect(`/report?event=${encodeURIComponent(String(formData.get("eventId") ?? ""))}&error=invalid`);
    const client = clientAddressFromHeaders(await headers());
    const allowed = await Promise.all([client ? consumeSharedRateLimit("report:client", client, 5, 60 * 60_000) : true, consumeSharedRateLimit("report:event", parsed.data.eventId, 50, 60 * 60_000)]);
    if (allowed.includes(false)) redirect(`/report?event=${parsed.data.eventId}&error=limited`);
    const [target] = await db.select({ id: events.id, name: events.name, slug: events.slug, orgSlug: organizations.slug, orgName: organizations.name }).from(events).innerJoin(organizations, eq(organizations.id, events.organizationId)).where(eq(events.id, parsed.data.eventId)).limit(1);
    if (!target) redirect(`/report?error=invalid`);
    await createEventReport(db, parsed.data);
    if (env.ABUSE_EMAIL && emailConfigured) {
      const props = { brand: { orgName: "Evnelo", appUrl: env.APP_URL }, eventName: target.name, eventUrl: `${env.APP_URL}${publicEventPath(target.orgSlug, target.slug)}`, orgName: target.orgName, reason: REASONS[parsed.data.reason] ?? parsed.data.reason, details: parsed.data.details || null, reporterEmail: parsed.data.reporterEmail || null };
      try {
        const { html, text } = await renderEmail(React.createElement(AbuseReport, props));
        await sendEmail({ to: env.ABUSE_EMAIL, subject: abuseReportSubject(props), html, text, replyTo: parsed.data.reporterEmail || undefined });
      } catch (e) { captureError("reports.email", e, { eventId: target.id }); }
    }
    redirect(`/report?event=${target.id}&sent=1`);
  }

  const description = !row
    ? (error === "invalid" ? "That event could not be found." : "Open this page from an event to report it.")
    : sent
      ? <span className="text-foreground">Thanks. Your report about <strong>{row.name}</strong> was recorded{env.ABUSE_EMAIL ? " and sent to the operators of this instance" : ""}.</span>
      : <>Reporting <strong className="text-foreground">{row.name}</strong> by {row.orgName}. Reports go to the people who run this Evnelo instance, not to the host.</>;

  return (
    <NarrowPage icon={<Flag />} eyebrow="Report" title="Report an event" description={description}>
      {row && !sent && (
        <>
          {error === "limited" && <div className="mb-4"><FormMessage error="Too many reports from your connection. Try again later." /></div>}
          {error === "invalid" && <div className="mb-4"><FormMessage error="Check the form and try again." /></div>}
          <form action={submit} className="space-y-5">
            <input type="hidden" name="eventId" value={row.id} />
            <div><Label htmlFor="reason">Reason</Label><Select id="reason" name="reason" className="mt-1.5 h-11" defaultValue="spam">{Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
            <div><Label htmlFor="details">Details <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="details" name="details" rows={4} maxLength={2000} className="mt-1.5" /></div>
            <div><Label htmlFor="reporterEmail">Your email <span className="font-normal text-muted-foreground">(optional, if we may follow up)</span></Label><Input id="reporterEmail" name="reporterEmail" type="email" className="mt-1.5 h-11" /></div>
            <Button type="submit" size="lg">Send report</Button>
          </form>
        </>
      )}
      {row && sent && (
        <Button asChild variant="outline" size="lg"><a href={publicEventPath(row.orgSlug, row.slug)}>Back to the event</a></Button>
      )}
    </NarrowPage>
  );
}
