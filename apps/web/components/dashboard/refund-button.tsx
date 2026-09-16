"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Undo2 } from "lucide-react";
import { RowAction, RowActions } from "@/components/dashboard/row-actions";
import { refundOrderAction } from "@/app/dashboard/actions";

/** The orders table's actions menu: refund what is left of the order, with a confirm and a result line. */
export function RefundButton({ eventId, orderId, amount, label }: { eventId: string; orderId: string; amount: string; label: string }) {
  const t = useTranslations("manage");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col items-end gap-1">
      <RowActions label={label} pending={pending}>
        <RowAction
          icon={<Undo2 />}
          confirm={t("refund.confirm", { amount })}
          onSelect={() => start(async () => {
            const r = await refundOrderAction(eventId, orderId);
            setMsg(r.ok ? r.message ?? t("refund.requested") : r.error);
            if (r.ok) router.refresh();
          })}
        >
          {t("refund.button", { amount })}
        </RowAction>
      </RowActions>
      {msg && <span className="max-w-56 text-end text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
