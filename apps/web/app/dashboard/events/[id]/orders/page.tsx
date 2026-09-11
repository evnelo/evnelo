import { Receipt } from "lucide-react";
import { listOrders } from "@ot/core/services";
import { can } from "@ot/core";
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
  const rows = await listOrders(db, id);
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
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
              <span className="tabular-nums text-foreground">{formatMoney(collected, currency)}</span> collected, net of refunds
            </p>
          )
        }
      >
        <p className="eyebrow">{rows.length} order{rows.length === 1 ? "" : "s"}</p>
      </Toolbar>

      <Table>
        <THead className="[&_th]:uppercase [&_th]:tracking-[0.12em]"><TR><TH>Order</TH><TH>Items</TH><TH>Status</TH><TH className="text-right">Total</TH><TH>Placed</TH>{refundable && <TH className="text-right">Actions</TH>}</TR></THead>
        <TBody>
          {rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={refundable ? 6 : 5}>
                <EmptyCell icon={Receipt} title="No orders yet" description="Every registration, free or paid, shows up here with what was collected." />
              </TD>
            </TR>
          )}
          {rows.map(({ order: o, buyerName, items, attendeeCount }) => (
            <TR key={o.id}>
              <TD><div className="font-medium">{buyerName ?? o.email}</div><div className="text-xs text-muted-foreground">{o.email} · {attendeeCount} {attendeeCount === 1 ? "person" : "people"}</div></TD>
              <TD className="text-muted-foreground">{items}</TD>
              <TD><Badge variant={statusVariant[o.status]}>{statusLabel(o.status)}</Badge>{o.refundedMinor > 0 && o.status === "partially_refunded" && <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">{formatMoney(o.refundedMinor, o.currency)} refunded</div>}</TD>
              <TD className="text-right tabular-nums">{o.totalMinor === 0 ? "Free" : formatMoney(o.totalMinor, o.currency)}</TD>
              <TD className="whitespace-nowrap tabular-nums text-muted-foreground">{fmt(o.createdAt)}</TD>
              {refundable && <TD className="text-right">{(o.status === "paid" || o.status === "partially_refunded") && o.stripePaymentIntentId && <RefundButton eventId={id} orderId={o.id} amount={formatMoney(o.totalMinor - o.refundedMinor, o.currency)} />}</TD>}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
