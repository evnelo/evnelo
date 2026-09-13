"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { refundOrderAction } from "@/app/dashboard/actions";

export function RefundButton({ eventId, orderId, amount }: { eventId: string; orderId: string; amount: string }) {
  const t = useTranslations("manage");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm" variant="outline" pending={pending}
        onClick={() => {
          if (!window.confirm(t("refund.confirm", { amount }))) return;
          start(async () => {
            const r = await refundOrderAction(eventId, orderId);
            setMsg(r.ok ? r.message ?? t("refund.requested") : r.error);
            if (r.ok) router.refresh();
          });
        }}
      >
        {t("refund.button", { amount })}
      </Button>
      {msg && <span className="max-w-56 text-end text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
