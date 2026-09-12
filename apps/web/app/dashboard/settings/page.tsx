import { ExternalLink } from "lucide-react";
import { listApiKeys, listMembers, listPendingInvites, listWebhookDeliveries, listWebhooks, webhookDeliveryState } from "@evnelo/core/services";
import { can, ROLE_LABELS } from "@evnelo/core";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrg } from "@/lib/auth/session";
import { paymentsConfigured } from "@/lib/payment-flow";
import { storageConfigured } from "@/lib/storage";
import { OrgForm } from "@/components/dashboard/org-form";
import { MembersPanel } from "@/components/dashboard/members-panel";
import { ApiKeysPanel } from "@/components/dashboard/api-keys-panel";
import { WebhooksPanel } from "@/components/dashboard/webhooks-panel";
import { DangerZone } from "@/components/dashboard/danger-zone";
import { LinkTabs } from "@/components/dashboard/link-tabs";
import { PageHeader, SectionCard, SectionTray } from "@/components/dashboard/page-chrome";

const TABS = [
  { key: "organization", label: "Organization" },
  { key: "members", label: "Members" },
  { key: "developer", label: "Developer" },
  { key: "payments", label: "Payments" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { org, role, user } = await requireOrg("view_events", "/dashboard/settings");
  const { tab: requested } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === requested) ? (requested as Tab) : "organization";
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

      <LinkTabs className="mt-6" active={tab} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "organization" ? "/dashboard/settings" : `/dashboard/settings?tab=${t.key}` }))} />

      <div className="mt-6 space-y-5">
        {tab === "organization" && (
          <>
            <SectionCard title="Organization" description="Name, public URL, logo and the accent colour used in emails and on ticket pages.">
              <OrgForm org={{ name: org.name, slug: org.slug, website: org.website ?? "", logoUrl: org.logoUrl ?? "", accentColor: org.accentColor ?? "", feePassThrough: org.feePassThrough, socialLinks: org.socialLinks }} readOnly={!can(role, "manage_org")} uploadsEnabled={storageConfigured} />
            </SectionCard>
            {can(role, "manage_org") && (
              <div className="hairline mt-12 pt-8">
                <DangerZone slug={org.slug} isOwner={role === "owner"} />
              </div>
            )}
          </>
        )}

        {tab === "members" && <MembersTab orgId={org.id} canManage={can(role, "manage_members")} currentUserId={user.id} />}

        {tab === "developer" && <DeveloperTab orgId={org.id} canManage={can(role, "manage_org")} />}

        {tab === "payments" && (
          <SectionCard title="Payments" description={env.EDITION === "cloud" ? "Paid tickets settle straight into your own Stripe account." : "This instance charges through the Stripe keys its operator configured."}>
            {env.EDITION === "cloud" ? (
              <p className="text-sm text-muted-foreground">{org.stripeAccountId ? `Stripe account ${org.stripeAccountId} connected.` : "Connect your Stripe account to sell paid tickets. Coming with the Connect onboarding flow."}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{paymentsConfigured(env.STRIPE_SECRET_KEY, env.STRIPE_PUBLISHABLE_KEY) ? "Stripe is configured. Paid tickets are charged on the instance's Stripe account with no platform fee." : "Stripe is not configured on this instance, so only free tickets can be sold. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to enable payments."}</p>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

async function MembersTab({ orgId, canManage, currentUserId }: { orgId: string; canManage: boolean; currentUserId: string }) {
  const [members, invites] = await Promise.all([listMembers(db, orgId), listPendingInvites(db, orgId)]);
  return (
    <SectionTray title="Members" description="Owners and admins manage the organization; members create and run events; check-in staff can only scan tickets.">
      <MembersPanel members={members.map((m) => ({ ...m, since: m.since.toISOString() }))} invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() }))} canManage={canManage} currentUserId={currentUserId} roleLabels={ROLE_LABELS} />
    </SectionTray>
  );
}

async function DeveloperTab({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const [apiKeys, hooks] = await Promise.all([listApiKeys(db, orgId), listWebhooks(db, orgId)]);
  const hookRows = await Promise.all(hooks.map(async (h) => ({
    id: h.id, url: h.url, events: h.events, active: h.active, createdAt: h.createdAt.toISOString(),
    recent: (await listWebhookDeliveries(db, orgId, h.id, 10)).map((d) => ({ id: d.id, event: d.event, state: webhookDeliveryState(d), attempts: d.attempts, responseStatus: d.responseStatus, createdAt: d.createdAt.toISOString() })),
  })));
  return (
    <>
      <SectionTray title="API keys" description="Server-to-server access to this organization's events, orders and attendees.">
        <ApiKeysPanel canManage={canManage} docsUrl="/api/v1/docs" keys={apiKeys.map((k) => ({ ...k, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString() }))} />
      </SectionTray>
      <SectionTray title="Webhooks" description="A signed JSON POST to your own endpoint whenever something happens here.">
        <WebhooksPanel hooks={hookRows} editable={canManage} />
      </SectionTray>
    </>
  );
}
