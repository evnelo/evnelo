import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, CalendarX, ExternalLink, Users } from "lucide-react";
import { platformOrganization } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { moneyText, shortDate } from "@/lib/admin-format";
import { statusVariant } from "@/lib/dashboard";
import { organizationPath, publicEventPath } from "@/lib/urls";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyCell, PageHeader, StatCard } from "@/components/dashboard/page-chrome";

export const dynamic = "force-dynamic";

const EVENT_STATUSES = ["draft", "published", "cancelled", "ended"] as const;
const ROLES = ["owner", "admin", "member", "checkin"] as const;

export default async function AdminOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/organizations/${id}`);
  if (!/^[0-9A-Z]{26}$/.test(id)) notFound();
  const [detail, t, locale] = await Promise.all([platformOrganization(db, id), getTranslations("dashboard"), getLocale()]);
  if (!detail) notFound();
  const { organization: org, members, events, money } = detail;
  const none = t("admin.none");
  const registrations = events.reduce((a, e) => a + e.registrations, 0);
  const live = !org.deletedAt;

  return (
    <div>
      <PageHeader
        above={<Link href="/admin" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 rtl:-scale-x-100" /> {t("admin.organization.back")}</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{org.name}{org.deletedAt && <Badge variant="muted">{t("admin.overview.deleted")}</Badge>}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{org.deletedAt ? t("admin.organization.deletedOn", { date: shortDate(org.deletedAt, locale) }) : t("admin.organization.created", { date: shortDate(org.createdAt, locale) })}</span>
            {live && <a href={organizationPath(org.slug)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline">{t("admin.organization.publicPage")} <ExternalLink className="size-3.5 rtl:-scale-x-100" /></a>}
            {org.website && <a href={org.website} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline">{t("admin.organization.website")} <ExternalLink className="size-3.5 rtl:-scale-x-100" /></a>}
            {org.stripeAccountId && <span className="font-mono text-xs">{t("admin.organization.stripeAccount", { id: org.stripeAccountId })}</span>}
          </span>
        }
      />

      <div className="mt-8 grid grid-cols-2 gap-3">
        <StatCard label={t("admin.organization.stats.events")} value={events.length} />
        <StatCard label={t("admin.organization.stats.registrations")} value={registrations} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <StatCard label={t("admin.organization.stats.netSales")} value={moneyText(money, "net", locale, none)} />
        <StatCard label={t("admin.organization.stats.refunded")} value={moneyText(money, "refunded", locale, none)} />
        <StatCard label={t("admin.organization.stats.fees")} value={moneyText(money, "platformFee", locale, none)} />
      </div>

      <h2 className="mt-10 font-display text-xl">{t("admin.organization.events.title")}</h2>
      <Table className="mt-3">
        <THead>
          <TR>
            <TH>{t("admin.organization.events.columns.event")}</TH>
            <TH>{t("admin.organization.events.columns.status")}</TH>
            <TH>{t("admin.organization.events.columns.starts")}</TH>
            <TH className="text-end">{t("admin.organization.events.columns.registrations")}</TH>
            <TH className="text-end">{t("admin.organization.events.columns.checkedIn")}</TH>
            <TH className="text-end">{t("admin.organization.events.columns.visitors")}</TH>
            <TH className="text-end">{t("admin.organization.events.columns.netSales")}</TH>
            <TH className="text-end">{t("admin.organization.events.columns.refunded")}</TH>
            <TH className="text-end">{t("admin.organization.events.columns.fees")}</TH>
          </TR>
        </THead>
        <TBody>
          {events.length === 0 ? (
            <tr><td colSpan={9}><EmptyCell icon={CalendarX} title={t("admin.organization.events.empty")} /></td></tr>
          ) : events.map((e) => (
            <TR key={e.id}>
              <TD className="max-w-72">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{e.name}</span>
                  {live && e.status !== "draft" && (
                    <a href={publicEventPath(org.slug, e.slug)} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground" aria-label={t("admin.organization.events.openPublic", { name: e.name })}>
                      <ExternalLink className="size-3.5 rtl:-scale-x-100" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t(`admin.visibility.${e.visibility}`)}</p>
              </TD>
              <TD><Badge variant={statusVariant[e.status] ?? "outline"}>{EVENT_STATUSES.includes(e.status) ? t(`status.event.${e.status}`) : e.status}</Badge></TD>
              <TD className="whitespace-nowrap tabular-nums">{shortDate(e.startsAt, locale, e.timezone)}</TD>
              <TD className="whitespace-nowrap text-end tabular-nums">{e.capacity ? t("admin.organization.events.capacity", { count: e.registrations, capacity: e.capacity }) : e.registrations}</TD>
              <TD className="text-end tabular-nums">{e.checkedIn}</TD>
              <TD className="text-end tabular-nums">{e.visitors}</TD>
              <TD className="whitespace-nowrap text-end tabular-nums">{moneyText(e.money, "net", locale, none)}</TD>
              <TD className="whitespace-nowrap text-end tabular-nums">{moneyText(e.money, "refunded", locale, none)}</TD>
              <TD className="whitespace-nowrap text-end tabular-nums">{moneyText(e.money, "platformFee", locale, none)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <h2 className="mt-10 font-display text-xl">{t("admin.organization.members.title")}</h2>
      <Table className="mt-3">
        <THead>
          <TR>
            <TH>{t("admin.organization.members.columns.name")}</TH>
            <TH>{t("admin.organization.members.columns.email")}</TH>
            <TH>{t("admin.organization.members.columns.role")}</TH>
            <TH>{t("admin.organization.members.columns.joined")}</TH>
          </TR>
        </THead>
        <TBody>
          {members.length === 0 ? (
            <tr><td colSpan={4}><EmptyCell icon={Users} title={t("admin.organization.members.empty")} /></td></tr>
          ) : members.map((m) => (
            <TR key={m.email}>
              <TD>{m.name ?? none}</TD>
              <TD><a href={`mailto:${m.email}`} className="underline-offset-4 hover:underline">{m.email}</a></TD>
              <TD>{ROLES.includes(m.role) ? t(`settings.members.roles.${m.role}`) : m.role}</TD>
              <TD className="whitespace-nowrap tabular-nums">{shortDate(m.joinedAt, locale)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
