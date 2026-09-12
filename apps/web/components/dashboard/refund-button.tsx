"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { refundOrderAction } from "@/app/dashboard/actions";

export function RefundButton({ eventId, orderId, amount }: { eventId: string; orderId: string; amount: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm" variant="outline" pending={pending}
        onClick={() => {
          if (!window.confirm(`Refund ${amount} in full? Tickets on this order stop working and the seats are released once Stripe confirms.`)) return;
          start(async () => {
            const r = await refundOrderAction(eventId, orderId);
            setMsg(r.ok ? r.message ?? "Refund requested." : r.error);
            if (r.ok) router.refresh();
          });
        }}
      >
        Refund {amount}
      </Button>
      {msg && <span className="max-w-56 text-right text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
