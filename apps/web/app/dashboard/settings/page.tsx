import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { listApiKeys, listMembers, listPendingInvites, listWebhookDeliveries, listWebhooks, webhookDeliveryState } from "@evnelo/core/services";
import { can, type Role } from "@evnelo/core";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrg } from "@/lib/auth/session";
import { paymentsConfigured } from "@/lib/payment-flow";
import { connectedAccountStatus, stripeConnectConfigured } from "@/lib/stripe-connect";
import { connectStripeAction } from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { storageConfigured } from "@/lib/storage";
import { OrgForm } from "@/components/dashboard/org-form";
import { MembersPanel } from "@/components/dashboard/members-panel";
import { ApiKeysPanel } from "@/components/dashboard/api-keys-panel";
import { WebhooksPanel } from "@/components/dashboard/webhooks-panel";
import { DangerZone } from "@/components/dashboard/danger-zone";
import { LinkTabs } from "@/components/dashboard/link-tabs";
import { PageHeader, SectionCard, SectionTray } from "@/components/dashboard/page-chrome";

const TABS = ["organization", "members", "developer", "payments"] as const;
type Tab = (typeof TABS)[number];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; connect?: string }> }) {
  const [{ org, role, user }, t] = await Promise.all([requireOrg("view_events", "/dashboard/settings"), getTranslations("dashboard")]);
  const { tab: requested, connect } = await searchParams;
  const tab: Tab = TABS.some((k) => k === requested) ? (requested as Tab) : "organization";
  const publicUrl = `${env.APP_URL.replace(/^https?:\/\//, "")}/o/${org.slug}`;

  return (
    <div>
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
        actions={
          <a href={`/o/${org.slug}`} target="_blank" rel="noopener noreferrer" className="press inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-[0_1px_1px_rgb(23_23_15/0.04)] hover:bg-muted/70">
            <span className="max-w-56 truncate">{publicUrl}</span>
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </a>
        }
      />

      <LinkTabs className="mt-6" active={tab} tabs={TABS.map((key) => ({ key, label: t(`settings.tabs.${key}`), href: key === "organization" ? "/dashboard/settings" : `/dashboard/settings?tab=${key}` }))} />

      <div className="mt-6 space-y-5">
        {tab === "organization" && (
          <>
            <SectionCard title={t("settings.organization.title")} description={t("settings.organization.description")}>
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
          <SectionCard title={t("settings.payments.title")} description={env.EDITION === "cloud" ? t("settings.payments.descriptionCloud") : t("settings.payments.descriptionSelfHosted")}>
            {env.EDITION === "cloud" ? (
              <CloudPayments accountId={org.stripeAccountId} canManage={can(role, "manage_org")} result={connect} />
            ) : (
              <p className="text-sm text-muted-foreground">{paymentsConfigured(env.STRIPE_SECRET_KEY, env.STRIPE_PUBLISHABLE_KEY) ? t("settings.payments.configured") : t("settings.payments.notConfigured")}</p>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

async function CloudPayments({ accountId, canManage, result }: { accountId: string | null; canManage: boolean; result?: string }) {
  const [t, status] = await Promise.all([getTranslations("dashboard"), connectedAccountStatus(accountId)]);
  const results = ["success", "cancelled", "invalid", "failed", "unconfigured"] as const;
  const knownResult = results.find((value) => value === result && (value !== "unconfigured" || stripeConnectConfigured));
  return (
    <div className="space-y-4">
      {knownResult && <p role="status" className={`rounded-xl border p-3 text-sm ${knownResult === "success" ? "border-border bg-muted" : "border-warning/40 bg-warning/10"}`}>{t(`settings.payments.results.${knownResult}`)}</p>}
      <Badge variant={status === "ready" ? "success" : status === "missing" ? "muted" : "warning"}>{t(`settings.payments.status.${status}`)}</Badge>
      <p className="text-sm text-muted-foreground">{accountId ? t("settings.payments.connected", { id: accountId }) : t("settings.payments.connectPrompt")}</p>
      {status === "restricted" && <p className="text-sm text-muted-foreground">{t("settings.payments.restrictedHelp")}</p>}
      {status === "unavailable" && <p className="text-sm text-muted-foreground">{t("settings.payments.unavailableHelp")}</p>}
      <p className="text-sm text-muted-foreground">{t("settings.payments.fees")} {t.rich("settings.payments.legal", { terms: (c) => <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{c}</a> })}</p>
      {!stripeConnectConfigured && <p className="text-sm text-muted-foreground">{t("settings.payments.results.unconfigured")}</p>}
      {canManage ? (
        <div className="flex flex-wrap items-center gap-3">
          {stripeConnectConfigured && status !== "ready" && <form action={connectStripeAction}><SubmitButton>{t(accountId ? "settings.payments.reconnect" : "settings.payments.connect")}</SubmitButton></form>}
          {accountId && <Button asChild variant="outline"><a href="https://dashboard.stripe.com/" target="_blank" rel="noopener noreferrer">{t("settings.payments.openStripe")}<ExternalLink className="size-4" aria-hidden /></a></Button>}
        </div>
      ) : <p className="text-sm text-muted-foreground">{t("settings.payments.managerRequired")}</p>}
    </div>
  );
}

async function MembersTab({ orgId, canManage, currentUserId }: { orgId: string; canManage: boolean; currentUserId: string }) {
  const [members, invites, t] = await Promise.all([listMembers(db, orgId), listPendingInvites(db, orgId), getTranslations("dashboard")]);
  const roleLabels: Record<Role, string> = { owner: t("settings.members.roles.owner"), admin: t("settings.members.roles.admin"), member: t("settings.members.roles.member"), checkin: t("settings.members.roles.checkin") };
  return (
    <SectionTray title={t("settings.members.title")} description={t("settings.members.description")}>
      <MembersPanel members={members.map((m) => ({ ...m, since: m.since.toISOString() }))} invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() }))} canManage={canManage} currentUserId={currentUserId} roleLabels={roleLabels} />
    </SectionTray>
  );
}

async function DeveloperTab({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const [apiKeys, hooks, t] = await Promise.all([listApiKeys(db, orgId), listWebhooks(db, orgId), getTranslations("dashboard")]);
  const hookRows = await Promise.all(hooks.map(async (h) => ({
    id: h.id, url: h.url, events: h.events, active: h.active, createdAt: h.createdAt.toISOString(),
    recent: (await listWebhookDeliveries(db, orgId, h.id, 10)).map((d) => ({ id: d.id, event: d.event, state: webhookDeliveryState(d), attempts: d.attempts, responseStatus: d.responseStatus, createdAt: d.createdAt.toISOString() })),
  })));
  return (
    <>
      <SectionTray title={t("settings.developer.apiKeys.title")} description={t("settings.developer.apiKeys.description")}>
        <ApiKeysPanel canManage={canManage} docsUrl="/api/v1/docs" keys={apiKeys.map((k) => ({ ...k, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString() }))} />
      </SectionTray>
      <SectionTray title={t("settings.developer.webhooks.title")} description={t("settings.developer.webhooks.description")}>
        <WebhooksPanel hooks={hookRows} editable={canManage} />
      </SectionTray>
    </>
  );
}
