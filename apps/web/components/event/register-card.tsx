"use client";

import { useState } from "react";
import type { RegistrationField, TicketType } from "@ot/db";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RegisterForm } from "./register-form";
import { formatMoney } from "@/lib/utils";

type Props = { eventId: string; eventName: string; ticketTypes: TicketType[]; fields: RegistrationField[]; collectPhone: boolean; requiresApproval: boolean; soldOut: boolean };

export function RegisterCard({ eventId, eventName, ticketTypes, fields, collectPhone, requiresApproval, soldOut }: Props) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<null | { orderId: string }>(null);
  const prices = ticketTypes.map((t) => t.priceMinor);
  const min = Math.min(...prices), max = Math.max(...prices);
  const priceLabel = !ticketTypes.length ? null : max === 0 ? "Free" : min === max ? formatMoney(min, ticketTypes[0]!.currency) : `${min === 0 ? "Free" : formatMoney(min, ticketTypes[0]!.currency)} to ${formatMoney(max, ticketTypes[0]!.currency)}`;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">{requiresApproval ? "Registration, approval required" : "Registration"}</span>
        {priceLabel && <span className="font-display text-xl" style={{ fontVariationSettings: '"opsz" 24' }}>{priceLabel}</span>}
      </div>
      {done ? (
        <p className="mt-4 text-sm">
          {requiresApproval ? "Request sent. You'll get an email once the host approves it." : "You're in. Your ticket is on its way to your inbox."}
        </p>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="event" size="lg" className="mt-4 w-full" disabled={soldOut || !ticketTypes.length}>
              {soldOut ? "Sold out" : requiresApproval ? "Request to join" : "Register"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogTitle>{eventName}</DialogTitle>
            <DialogDescription>Fill in your details to get your ticket.</DialogDescription>
            <div className="mt-4">
              <RegisterForm eventId={eventId} ticketTypes={ticketTypes} fields={fields} collectPhone={collectPhone}
                onSubmitted={(r) => { setDone(r); setOpen(false); }} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
