import { listOrders } from "@ot/core/services";
import { can } from "@ot/core";
import { db } from "@/lib/db";
import { requireEvent, statusLabel, statusVariant } from "@/lib/dashboard";
import { formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { RefundButton } from "@/components/dashboard/refund-button";

export default async function OrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireEvent(id);
  const rows = await listOrders(db, id);
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
  const refundable = can(role, "refund");
  return (
    <Table>
      <THead><TR><TH>Order</TH><TH>Items</TH><TH>Status</TH><TH className="text-right">Total</TH><TH>Placed</TH>{refundable && <TH className="text-right">Actions</TH>}</TR></THead>
      <TBody>
        {rows.length === 0 && <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">No orders yet.</TD></TR>}
        {rows.map(({ order: o, buyerName, items, attendeeCount }) => (
          <TR key={o.id}>
            <TD><div className="font-medium">{buyerName ?? o.email}</div><div className="text-xs text-muted-foreground">{o.email} · {attendeeCount} {attendeeCount === 1 ? "person" : "people"}</div></TD>
            <TD className="text-muted-foreground">{items}</TD>
            <TD><Badge variant={statusVariant[o.status]}>{statusLabel(o.status)}</Badge>{o.refundedMinor > 0 && o.status === "partially_refunded" && <div className="text-xs text-muted-foreground">{formatMoney(o.refundedMinor, o.currency)} refunded</div>}</TD>
            <TD className="text-right tabular-nums">{o.totalMinor === 0 ? "Free" : formatMoney(o.totalMinor, o.currency)}</TD>
            <TD className="whitespace-nowrap text-muted-foreground">{fmt(o.createdAt)}</TD>
            {refundable && <TD className="text-right">{(o.status === "paid" || o.status === "partially_refunded") && o.stripePaymentIntentId && <RefundButton eventId={id} orderId={o.id} amount={formatMoney(o.totalMinor - o.refundedMinor, o.currency)} />}</TD>}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
