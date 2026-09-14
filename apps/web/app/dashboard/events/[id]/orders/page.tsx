import { getLocale, getTranslations } from "next-intl/server";
import { Receipt } from "lucide-react";
import { listOrders } from "@evnelo/core/services";
import { can } from "@evnelo/core";
import { db } from "@/lib/db";
import { requireEvent, statusLabel, statusVariant } from "@/lib/dashboard";
import { formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { RefundButton } from "@/components/dashboard/refund-button";
import { EmptyCell, Toolbar } from "@/components/dashboard/page-chrome";

export default async function OrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireEvent(id);
  const [rows, t, tc, locale] = await Promise.all([listOrders(db, id), getTranslations("dashboard"), getTranslations("common"), getLocale()]);
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
  const refundable = can(role, "refund");
  const settled = rows.filter((r) => r.order.status === "paid" || r.order.status === "partially_refunded");
  const collected = settled.reduce((a, r) => a + r.order.totalMinor - r.order.refundedMinor, 0);
  const currency = rows[0]?.order.currency ?? "USD";

  return (
    <div className="space-y-4">
      <Toolbar
        actions={
          rows.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t.rich("event.orders.collected", { amount: formatMoney(collected, currency, locale), strong: (chunks) => <span className="tabular-nums text-foreground">{chunks}</span> })}
            </p>
          )
        }
      >
        <p className="eyebrow">{t("event.orders.count", { count: rows.length })}</p>
      </Toolbar>

      <Table>
        <THead className="[&_th]:uppercase [&_th]:tracking-[0.12em]"><TR><TH>{t("event.orders.columns.order")}</TH><TH>{t("event.orders.columns.items")}</TH><TH>{tc("labels.status")}</TH><TH className="text-end">{t("event.orders.columns.total")}</TH><TH>{t("event.orders.columns.placed")}</TH>{refundable && <TH className="text-end">{t("event.orders.columns.actions")}</TH>}</TR></THead>
        <TBody>
          {rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={refundable ? 6 : 5}>
                <EmptyCell icon={Receipt} title={t("event.orders.empty.title")} description={t("event.orders.empty.description")} />
              </TD>
            </TR>
          )}
          {rows.map(({ order: o, buyerName, items, attendeeCount }) => (
            <TR key={o.id}>
              <TD><div className="font-medium">{buyerName ?? o.email}</div><div className="text-xs text-muted-foreground">{o.email} · {t("event.orders.people", { count: attendeeCount })}</div></TD>
              <TD className="text-muted-foreground">{items}</TD>
              <TD><Badge variant={statusVariant[o.status]}>{t(`status.order.${o.status}`)}</Badge>{o.disputedAt && <Badge variant="destructive" className="ms-1">{t("event.orders.disputed", { status: statusLabel(o.disputeStatus ?? "") })}</Badge>}{o.refundedMinor > 0 && o.status === "partially_refunded" && <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">{t("event.orders.refunded", { amount: formatMoney(o.refundedMinor, o.currency, locale) })}</div>}</TD>
              <TD className="text-end tabular-nums">{o.totalMinor === 0 ? tc("labels.free") : formatMoney(o.totalMinor, o.currency, locale)}</TD>
              <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{fmt(o.createdAt)}</TD>
              {refundable && <TD className="text-end">{(o.status === "paid" || o.status === "partially_refunded") && o.stripePaymentIntentId && <RefundButton eventId={id} orderId={o.id} amount={formatMoney(o.totalMinor - o.refundedMinor, o.currency, locale)} />}</TD>}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
