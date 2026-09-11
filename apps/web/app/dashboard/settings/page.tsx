import { listApiKeys, listMembers, listPendingInvites, listWebhookDeliveries, listWebhooks, webhookDeliveryState } from "@ot/core/services";
import { can, ROLE_LABELS } from "@ot/core";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrg } from "@/lib/auth/session";
import { OrgForm } from "@/components/dashboard/org-form";
import { MembersPanel } from "@/components/dashboard/members-panel";
import { ApiKeysPanel } from "@/components/dashboard/api-keys-panel";
import { WebhooksPanel } from "@/components/dashboard/webhooks-panel";

export default async function SettingsPage() {
  const { org, role, user } = await requireOrg("view_events", "/dashboard/settings");
  const [members, invites, apiKeys, hooks] = await Promise.all([listMembers(db, org.id), listPendingInvites(db, org.id), listApiKeys(db, org.id), listWebhooks(db, org.id)]);
  const hookRows = await Promise.all(hooks.map(async (h) => ({
    id: h.id, url: h.url, events: h.events, active: h.active, createdAt: h.createdAt.toISOString(),
    recent: (await listWebhookDeliveries(db, org.id, h.id, 10)).map((d) => ({ id: d.id, event: d.event, state: webhookDeliveryState(d), attempts: d.attempts, responseStatus: d.responseStatus, createdAt: d.createdAt.toISOString() })),
  })));
  return (
    <div className="space-y-10">
      <div>
        <h1 className="display text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Public page: <a href={`/o/${org.slug}`} className="underline underline-offset-4">{env.APP_URL.replace(/^https?:\/\//, "")}/o/{org.slug}</a></p>
      </div>
      <section>
        <h2 className="text-lg font-medium">Organization</h2>
        <div className="mt-4">
          <OrgForm org={{ name: org.name, slug: org.slug, website: org.website ?? "", logoUrl: org.logoUrl ?? "", accentColor: org.accentColor ?? "", feePassThrough: org.feePassThrough, socialLinks: org.socialLinks }} readOnly={!can(role, "manage_org")} />
        </div>
      </section>
      <section>
        <h2 className="text-lg font-medium">Members</h2>
        <p className="mt-1 text-sm text-muted-foreground">Owners and admins manage the organization; members create and run events; check-in staff can only scan tickets.</p>
        <div className="mt-4">
          <MembersPanel members={members.map((m) => ({ ...m, since: m.since.toISOString() }))} invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() }))} canManage={can(role, "manage_members")} currentUserId={user.id} roleLabels={ROLE_LABELS} />
        </div>
      </section>
      <section>
        <h2 className="text-lg font-medium">API keys</h2>
        <div className="mt-4">
          <ApiKeysPanel canManage={can(role, "manage_org")} docsUrl="/api/v1/docs" keys={apiKeys.map((k) => ({ ...k, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString() }))} />
        </div>
      </section>
      <section>
        <div className="mt-4">
          <WebhooksPanel hooks={hookRows} editable={can(role, "manage_org")} />
        </div>
      </section>
      {env.EDITION === "cloud" && (
        <section>
          <h2 className="text-lg font-medium">Payments</h2>
          <p className="mt-1 text-sm text-muted-foreground">{org.stripeAccountId ? `Stripe account ${org.stripeAccountId} connected.` : "Connect your Stripe account to sell paid tickets. Coming with the Connect onboarding flow."}</p>
        </section>
      )}
    </div>
  );
}
