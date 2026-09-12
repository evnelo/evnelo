"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock } from "lucide-react";
import type { RegistrationField, TicketType } from "@evnelo/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RegisterForm } from "./register-form";
import { WaitlistJoin } from "./waitlist-join";
import { PaymentStep } from "./payment-step";
import { cn, formatMoney } from "@/lib/utils";
import { paymentHold, paymentOutcome, registrationSuccessMessage, type PaymentOutcome } from "@/lib/payment-flow";

type Props = {
  eventId: string; eventName: string; ticketTypes: TicketType[]; fields: RegistrationField[];
  collectPhone: boolean; requiresApproval: boolean; soldOut: boolean; guestsEnabled: boolean; maxGuests: number;
  stripePublishableKey?: string | null;
  waitlist?: { enabled: boolean; offer: { email: string; expiresAt: string; ticketTypeName: string } | null };
};
type ResumeCredentials = { token: string; clientSecret: string };
type PaymentState = ResumeCredentials & {
  orderId: string; stripeAccountId?: string | null; holdExpiresAt: string; partySize: number; requiresApproval: boolean;
};

/** Details → Payment, shown at the top of the dialog whenever a paid ticket is on offer. */
function Steps({ current }: { current: 1 | 2 }) {
  const step = (n: 1 | 2, label: string) => {
    const done = n < current, active = n === current;
    return (
      <li className={cn("flex items-center gap-2", active ? "text-foreground" : "text-muted-foreground")} aria-current={active ? "step" : undefined}>
        <span className={cn("flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums", active && "border-event bg-event text-event-foreground", done && "border-event text-event")}>
          {done ? <Check className="size-3.5" aria-hidden /> : n}
        </span>
        <span className="text-xs font-medium">{label}</span>
      </li>
    );
  };
  return (
    <ol className="mb-4 flex items-center gap-3 pr-8" aria-label="Steps">
      {step(1, "Details")}
      <span aria-hidden className="h-px w-8 bg-border" />
      {step(2, "Payment")}
    </ol>
  );
}

export function RegisterCard({ eventId, eventName, ticketTypes, fields, collectPhone, requiresApproval, soldOut, guestsEnabled, maxGuests, stripePublishableKey, waitlist }: Props) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string>();
  const [payment, setPayment] = useState<PaymentState>();
  const [resumeCredentials, setResumeCredentials] = useState<ResumeCredentials>();
  const [resumeError, setResumeError] = useState<string>();
  const [canRegisterAgain, setCanRegisterAgain] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const doneRef = useRef<HTMLParagraphElement>(null);
  const storageKey = `ev_payment_resume:${eventId}`;
  const prices = ticketTypes.map((t) => t.priceMinor);
  const min = Math.min(...prices), max = Math.max(...prices);
  const priceLabel = !ticketTypes.length ? null : max === 0 ? "Free" : min === max ? formatMoney(min, ticketTypes[0]!.currency) : `${min === 0 ? "Free" : formatMoney(min, ticketTypes[0]!.currency)} to ${formatMoney(max, ticketTypes[0]!.currency)}`;
  const paidPossible = Boolean(stripePublishableKey) && ticketTypes.some((t) => t.priceMinor > 0);

  const clearPaymentQuery = useCallback(() => {
    const url = new URL(window.location.href);
    for (const key of ["ev_resume", "payment_intent", "payment_intent_client_secret", "redirect_status"]) url.searchParams.delete(key);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  const persistResume = useCallback((credentials: ResumeCredentials) => {
    sessionStorage.setItem(storageKey, JSON.stringify(credentials));
    setResumeCredentials(credentials);
  }, [storageKey]);
  const clearResume = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    setResumeCredentials(undefined);
    clearPaymentQuery();
  }, [clearPaymentQuery, storageKey]);

  const restorePayment = useCallback(async (credentials: ResumeCredentials) => {
    setResuming(true);
    setResumeError(undefined);
    try {
      const response = await fetch("/api/orders/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: credentials.token, clientSecret: credentials.clientSecret, eventId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Payment session could not be verified.");
      const outcome = paymentOutcome(result.paymentStatus);
      if (outcome.state === "complete" && result.orderStatus === "paid") {
        setProcessing(false);
        setDone(registrationSuccessMessage(result.requiresApproval, result.partySize, true));
        clearResume();
        return;
      }
      if (outcome.state === "processing" && result.orderStatus === "processing") {
        setPayment(undefined);
        setProcessing(true);
        setOpen(false);
        return;
      }
      if (result.orderStatus !== "pending" || !result.holdExpiresAt || paymentHold(result.holdExpiresAt).expired) {
        setPayment(undefined);
        setProcessing(false);
        setCanRegisterAgain(true);
        setResumeError(result.refunded
          ? "Your payment arrived after the reservation had lapsed, so it has been refunded; it will show on your statement within 5 to 10 days. Register again to get a ticket."
          : "This ticket reservation expired or closed. Register again to continue.");
        clearResume();
        return;
      }
      setProcessing(false);
      setPayment({
        orderId: result.orderId, clientSecret: result.clientSecret, stripeAccountId: result.stripeAccountId,
        token: credentials.token, holdExpiresAt: result.holdExpiresAt, partySize: result.partySize, requiresApproval: result.requiresApproval,
      });
      setOpen(true);
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : "Payment session could not be verified.");
    } finally {
      setResuming(false);
    }
  }, [clearResume, eventId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("ev_resume") && params.get("payment_intent_client_secret")
      ? { token: params.get("ev_resume")!, clientSecret: params.get("payment_intent_client_secret")! }
      : undefined;
    let credentials = fromUrl;
    if (fromUrl) {
      sessionStorage.setItem(storageKey, JSON.stringify(fromUrl));
      clearPaymentQuery();
    } else {
      try { credentials = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") ?? undefined; } catch { sessionStorage.removeItem(storageKey); }
    }
    if (!credentials) return;
    setResumeCredentials(credentials);
    void restorePayment(credentials);
  }, [clearPaymentQuery, restorePayment, storageKey]);

  // while a delayed payment is processing: poll for two minutes, then leave the manual "Check payment" button
  useEffect(() => {
    if (!processing || !resumeCredentials) return;
    let polls = 0;
    const timer = setInterval(() => { if (++polls > 24) return clearInterval(timer); void restorePayment(resumeCredentials); }, 5_000);
    return () => clearInterval(timer);
  }, [processing, restorePayment, resumeCredentials]);
  useEffect(() => { if (done) doneRef.current?.focus(); }, [done]);

  // Stripe's client-side result is a hint only: the server settles the order and reports back.
  const completePayment = useCallback((outcome: PaymentOutcome) => {
    if (!payment) return;
    if (outcome.state === "processing") setProcessing(true);
    setPayment(undefined);
    setOpen(false);
    void restorePayment({ token: payment.token, clientSecret: payment.clientSecret });
  }, [payment, restorePayment]);

  function startAgain() {
    setCanRegisterAgain(false);
    setResumeError(undefined);
    setProcessing(false);
    setOpen(true);
  }

  const free = priceLabel === "Free";
  return (
    <div className="rounded-xl border border-border/80 bg-card p-6 shadow-lift">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{requiresApproval ? "Registration, approval required" : guestsEnabled ? "Registration, guests welcome" : "Registration"}</p>
          {priceLabel && !free && (
            <p className="display mt-2 text-4xl tabular-nums">{priceLabel}</p>
          )}
          {free && <p className="mt-2"><Badge variant="stamp" className="text-primary">Free</Badge></p>}
        </div>
        {soldOut && <Badge variant="stamp" className="mt-1 shrink-0">Sold out</Badge>}
      </div>
      {waitlist?.offer && !done && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-accent/70 px-3 py-2.5 text-xs text-accent-foreground">
          <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>A <strong>{waitlist.offer.ticketTypeName}</strong> spot is reserved for {waitlist.offer.email} until {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(waitlist.offer.expiresAt))}. Register with that email.</span>
        </p>
      )}
      {done ? (
        <p ref={doneRef} tabIndex={-1} aria-live="polite" className="mt-4 flex items-start gap-2 rounded-lg bg-accent/70 px-3 py-3 text-sm text-accent-foreground">
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{done}</span>
        </p>
      ) : soldOut && waitlist?.enabled ? (
        <WaitlistJoin eventId={eventId} eventName={eventName} />
      ) : processing ? (
        <div className="mt-4 space-y-2" aria-live="polite">
          <p className="text-sm">Payment processing. We’ll email your ticket when Stripe confirms it.</p>
          {resumeError && <p className="text-sm text-destructive">{resumeError}</p>}
          {resumeCredentials && <Button type="button" size="sm" variant="outline" pending={resuming} onClick={() => void restorePayment(resumeCredentials)}>{"Check payment"}</Button>}
        </div>
      ) : resuming ? (
        <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">Verifying your payment…</p>
      ) : resumeError ? (
        <div className="mt-4 space-y-2" role="alert">
          <p className="text-sm text-destructive">{resumeError}</p>
          <div className="flex flex-wrap gap-2">
            {!canRegisterAgain && resumeCredentials && <Button type="button" size="sm" variant="outline" onClick={() => void restorePayment(resumeCredentials)}>Check again</Button>}
            <Button type="button" size="sm" variant={canRegisterAgain ? "default" : "ghost"} onClick={() => { clearResume(); startAgain(); }}>Register again</Button>
          </div>
        </div>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="event" size="lg" className="mt-5 w-full" disabled={soldOut || !ticketTypes.length}>
              {soldOut ? "Sold out" : requiresApproval ? "Request to join" : "Register"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            {paidPossible && <Steps current={payment ? 2 : 1} />}
            <DialogTitle>{payment ? "Complete payment" : eventName}</DialogTitle>
            <DialogDescription>{payment ? "Complete payment before the reservation timer expires." : "Fill in your details to get your ticket."}</DialogDescription>
            <div className="mt-5">
              {payment && stripePublishableKey ? (
                <PaymentStep clientSecret={payment.clientSecret} stripeAccountId={payment.stripeAccountId} resumeToken={payment.token} holdExpiresAt={payment.holdExpiresAt} publishableKey={stripePublishableKey} onComplete={completePayment} />
              ) : (
                <RegisterForm eventId={eventId} ticketTypes={ticketTypes} fields={fields} collectPhone={collectPhone}
                  guestsEnabled={guestsEnabled} maxGuests={maxGuests}
                  onSubmitted={(result) => {
                    if (result.clientSecret && result.resumeToken && result.holdExpiresAt) {
                      const credentials = { token: result.resumeToken, clientSecret: result.clientSecret };
                      persistResume(credentials);
                      setPayment({ ...credentials, orderId: result.orderId, stripeAccountId: result.stripeAccountId, holdExpiresAt: result.holdExpiresAt, partySize: result.partySize, requiresApproval });
                    } else if (!result.clientSecret) {
                      setDone(registrationSuccessMessage(requiresApproval, result.partySize, false));
                      setOpen(false);
                    } else {
                      setResumeError("Payment could not be started. Your reservation will be released automatically.");
                      setOpen(false);
                    }
                  }} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
