import { ExternalLink } from "lucide-react";
import { listApiKeys, listMembers, listPendingInvites, listWebhookDeliveries, listWebhooks, webhookDeliveryState } from "@evnelo/core/services";
import { can, ROLE_LABELS } from "@evnelo/core";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrg } from "@/lib/auth/session";
import { storageConfigured } from "@/lib/storage";
import { OrgForm } from "@/components/dashboard/org-form";
import { MembersPanel } from "@/components/dashboard/members-panel";
import { ApiKeysPanel } from "@/components/dashboard/api-keys-panel";
import { WebhooksPanel } from "@/components/dashboard/webhooks-panel";
import { DangerZone } from "@/components/dashboard/danger-zone";
import { PageHeader, SectionCard, SectionTray } from "@/components/dashboard/page-chrome";

export default async function SettingsPage() {
  const { org, role, user } = await requireOrg("view_events", "/dashboard/settings");
  const [members, invites, apiKeys, hooks] = await Promise.all([listMembers(db, org.id), listPendingInvites(db, org.id), listApiKeys(db, org.id), listWebhooks(db, org.id)]);
  const hookRows = await Promise.all(hooks.map(async (h) => ({
    id: h.id, url: h.url, events: h.events, active: h.active, createdAt: h.createdAt.toISOString(),
    recent: (await listWebhookDeliveries(db, org.id, h.id, 10)).map((d) => ({ id: d.id, event: d.event, state: webhookDeliveryState(d), attempts: d.attempts, responseStatus: d.responseStatus, createdAt: d.createdAt.toISOString() })),
  })));
  const publicUrl = `${env.APP_URL.replace(/^https?:\/\//, "")}/o/${org.slug}`;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="How your organization looks in public, who can work in it, and how other systems talk to it."
        actions={
          <a href={`/o/${org.slug}`} target="_blank" rel="noopener noreferrer" className="press inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-[0_1px_1px_rgb(23_23_15/0.04)] hover:bg-muted/70">
            <span className="max-w-56 truncate">{publicUrl}</span>
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </a>
        }
      />

      <div className="mt-8 space-y-5">
        <SectionCard title="Organization" description="Name, public URL, logo and the accent colour used in emails and on ticket pages.">
          <OrgForm org={{ name: org.name, slug: org.slug, website: org.website ?? "", logoUrl: org.logoUrl ?? "", accentColor: org.accentColor ?? "", feePassThrough: org.feePassThrough, socialLinks: org.socialLinks }} readOnly={!can(role, "manage_org")} uploadsEnabled={storageConfigured} />
        </SectionCard>

        <SectionTray title="Members" description="Owners and admins manage the organization; members create and run events; check-in staff can only scan tickets.">
          <MembersPanel members={members.map((m) => ({ ...m, since: m.since.toISOString() }))} invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() }))} canManage={can(role, "manage_members")} currentUserId={user.id} roleLabels={ROLE_LABELS} />
        </SectionTray>

        <SectionTray title="API keys" description="Server-to-server access to this organization's events, orders and attendees.">
          <ApiKeysPanel canManage={can(role, "manage_org")} docsUrl="/api/v1/docs" keys={apiKeys.map((k) => ({ ...k, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString() }))} />
        </SectionTray>

        <SectionTray title="Webhooks" description="A signed JSON POST to your own endpoint whenever something happens here.">
          <WebhooksPanel hooks={hookRows} editable={can(role, "manage_org")} />
        </SectionTray>

        {env.EDITION === "cloud" && (
          <SectionCard title="Payments" description="Paid tickets settle straight into your own Stripe account.">
            <p className="text-sm text-muted-foreground">{org.stripeAccountId ? `Stripe account ${org.stripeAccountId} connected.` : "Connect your Stripe account to sell paid tickets. Coming with the Connect onboarding flow."}</p>
          </SectionCard>
        )}
      </div>

      {can(role, "manage_org") && (
        <div className="hairline mt-12 pt-8">
          <DangerZone slug={org.slug} isOwner={role === "owner"} />
        </div>
      )}
    </div>
  );
}
