import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Building2, ExternalLink, Search } from "lucide-react";
import { platformOverview } from "@evnelo/core/services";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { moneyText, paidOrders, shortDate } from "@/lib/admin-format";
import { organizationPath } from "@/lib/urls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState, PageHeader, StatCard } from "@/components/dashboard/page-chrome";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const [{ q: rawQ }, overview, t, locale] = await Promise.all([searchParams, platformOverview(db), getTranslations("dashboard"), getLocale()]);
  const q = (rawQ ?? "").trim().slice(0, 100);
  const needle = q.toLowerCase();
  const rows = needle ? overview.organizations.filter((o) => [o.name, o.slug, o.ownerEmail ?? ""].some((v) => v.toLowerCase().includes(needle))) : overview.organizations;
  const none = t("admin.none");
  const { counts, money } = overview;

  return (
    <div>
      <PageHeader title={t("admin.overview.title")} description={t("admin.overview.description")} />

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("admin.overview.stats.organizations")} value={counts.organizations} />
        <StatCard label={t("admin.overview.stats.users")} value={counts.users} />
        <StatCard label={t("admin.overview.stats.published")} value={counts.published} />
        <StatCard label={t("admin.overview.stats.registrations")} value={counts.registrations} />
      </div>
      {/* money gets the wide row: several currencies join into one long line */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <StatCard label={t("admin.overview.stats.netSales")} value={moneyText(money, "net", locale, none)} sub={t("admin.overview.stats.netSalesSub")} />
        <StatCard label={t("admin.overview.stats.fees")} value={moneyText(money, "platformFee", locale, none)} sub={t("admin.overview.stats.feesSub", { orders: paidOrders(money) })} />
      </div>

      <form className="mt-10 flex max-w-md items-end gap-2" role="search">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t("admin.overview.search.label")}</span>
          <Input name="q" type="search" defaultValue={q} placeholder={t("admin.overview.search.placeholder")} />
        </label>
        <Button type="submit" variant="outline"><Search className="size-4" /> {t("admin.overview.search.submit")}</Button>
        {q && <Button asChild variant="ghost"><Link href="/admin">{t("admin.overview.search.clear")}</Link></Button>}
      </form>

      {rows.length === 0 ? (
        <EmptyState className="mt-6" icon={Building2} title={q ? t("admin.overview.emptySearch", { q }) : t("admin.overview.empty")} />
      ) : (
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>{t("admin.overview.columns.organization")}</TH>
              <TH>{t("admin.overview.columns.owner")}</TH>
              <TH>{t("admin.overview.columns.created")}</TH>
              <TH>{t("admin.overview.columns.events")}</TH>
              <TH className="text-end">{t("admin.overview.columns.registrations")}</TH>
              <TH className="text-end">{t("admin.overview.columns.netSales")}</TH>
              <TH className="text-end">{t("admin.overview.columns.fees")}</TH>
              <TH>{t("admin.overview.columns.payments")}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((o) => (
              <TR key={o.id} className={o.deletedAt ? "text-muted-foreground" : undefined}>
                <TD className="max-w-64">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/organizations/${o.id}`} className="truncate font-medium text-foreground underline-offset-4 hover:underline">{o.name}</Link>
                    {!o.deletedAt && (
                      <a href={organizationPath(o.slug)} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground" aria-label={t("admin.overview.openPublic", { name: o.name })}>
                        <ExternalLink className="size-3.5 rtl:-scale-x-100" />
                      </a>
                    )}
                    {o.deletedAt && <Badge variant="muted">{t("admin.overview.deleted")}</Badge>}
                  </div>
                  <p className="truncate font-mono text-xs text-muted-foreground">/{o.slug}</p>
                </TD>
                <TD className="max-w-56 truncate">{o.ownerEmail ?? <span className="text-muted-foreground">{t("admin.overview.noOwner")}</span>}</TD>
                <TD className="whitespace-nowrap tabular-nums">{shortDate(o.createdAt, locale)}</TD>
                <TD className="whitespace-nowrap tabular-nums">{t("admin.overview.eventsCell", { published: o.published, total: o.events })}</TD>
                <TD className="text-end tabular-nums">{o.registrations}</TD>
                <TD className="whitespace-nowrap text-end tabular-nums">{moneyText(o.money, "net", locale, none)}</TD>
                <TD className="whitespace-nowrap text-end tabular-nums">{moneyText(o.money, "platformFee", locale, none)}</TD>
                <TD className="whitespace-nowrap">
                  {o.stripeChargesEnabled ? <Badge variant="success">{t("admin.overview.payments.ready")}</Badge>
                    : o.stripeConnected ? <Badge variant="warning">{t("admin.overview.payments.notReady")}</Badge>
                    : <span className="text-xs text-muted-foreground">{t("admin.overview.payments.none")}</span>}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
