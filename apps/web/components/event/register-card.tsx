"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RegistrationField, TicketType } from "@ot/db";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RegisterForm } from "./register-form";
import { WaitlistJoin } from "./waitlist-join";
import { PaymentStep } from "./payment-step";
import { formatMoney } from "@/lib/utils";
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
  const storageKey = `ot_payment_resume:${eventId}`;
  const prices = ticketTypes.map((t) => t.priceMinor);
  const min = Math.min(...prices), max = Math.max(...prices);
  const priceLabel = !ticketTypes.length ? null : max === 0 ? "Free" : min === max ? formatMoney(min, ticketTypes[0]!.currency) : `${min === 0 ? "Free" : formatMoney(min, ticketTypes[0]!.currency)} to ${formatMoney(max, ticketTypes[0]!.currency)}`;

  const clearPaymentQuery = useCallback(() => {
    const url = new URL(window.location.href);
    for (const key of ["ot_resume", "payment_intent", "payment_intent_client_secret", "redirect_status"]) url.searchParams.delete(key);
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
    const fromUrl = params.get("ot_resume") && params.get("payment_intent_client_secret")
      ? { token: params.get("ot_resume")!, clientSecret: params.get("payment_intent_client_secret")! }
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

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">{requiresApproval ? "Registration, approval required" : guestsEnabled ? "Registration, guests welcome" : "Registration"}</span>
        {priceLabel && <span className="font-display text-xl" style={{ fontVariationSettings: '\"opsz\" 24' }}>{priceLabel}</span>}
      </div>
      {waitlist?.offer && !done && (
        <p className="mt-3 rounded-md border border-[#c9d9c0] bg-[#eef6ea] px-3 py-2 text-xs">A <strong>{waitlist.offer.ticketTypeName}</strong> spot is reserved for {waitlist.offer.email} until {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(waitlist.offer.expiresAt))}. Register with that email.</p>
      )}
      {done ? (
        <p ref={doneRef} tabIndex={-1} aria-live="polite" className="mt-4 text-sm">{done}</p>
      ) : soldOut && waitlist?.enabled ? (
        <WaitlistJoin eventId={eventId} eventName={eventName} />
      ) : processing ? (
        <div className="mt-4 space-y-2" aria-live="polite">
          <p className="text-sm">Payment processing. We’ll email your ticket when Stripe confirms it.</p>
          {resumeError && <p className="text-sm text-destructive">{resumeError}</p>}
          {resumeCredentials && <Button type="button" size="sm" variant="outline" disabled={resuming} onClick={() => void restorePayment(resumeCredentials)}>{resuming ? "Checking…" : "Check payment"}</Button>}
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
            <Button variant="event" size="lg" className="mt-4 w-full" disabled={soldOut || !ticketTypes.length}>
              {soldOut ? "Sold out" : requiresApproval ? "Request to join" : "Register"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogTitle>{payment ? "Complete payment" : eventName}</DialogTitle>
            <DialogDescription>{payment ? "Complete payment before the reservation timer expires." : "Fill in your details to get your ticket."}</DialogDescription>
            <div className="mt-4">
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
