"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RegistrationField, TicketType } from "@ot/db";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RegisterForm } from "./register-form";
import { PaymentStep } from "./payment-step";
import { formatMoney } from "@/lib/utils";
import { paymentHold, paymentOutcome, registrationSuccessMessage, type PaymentOutcome } from "@/lib/payment-flow";

type Props = {
  eventId: string; eventName: string; ticketTypes: TicketType[]; fields: RegistrationField[];
  collectPhone: boolean; requiresApproval: boolean; soldOut: boolean; guestsEnabled: boolean; maxGuests: number;
  stripePublishableKey?: string | null;
};
type ResumeCredentials = { token: string; clientSecret: string };
type PaymentState = ResumeCredentials & {
  orderId: string; stripeAccountId?: string | null; holdExpiresAt: string; partySize: number; requiresApproval: boolean;
};

export function RegisterCard({ eventId, eventName, ticketTypes, fields, collectPhone, requiresApproval, soldOut, guestsEnabled, maxGuests, stripePublishableKey }: Props) {
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
        setResumeError("This ticket reservation expired or closed. Register again to continue.");
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

  useEffect(() => {
    if (!processing || !resumeCredentials) return;
    const timer = setInterval(() => void restorePayment(resumeCredentials), 5_000);
    return () => clearInterval(timer);
  }, [processing, restorePayment, resumeCredentials]);
  useEffect(() => { if (done) doneRef.current?.focus(); }, [done]);

  const completePayment = useCallback((outcome: PaymentOutcome) => {
    if (!payment) return;
    if (outcome.state === "processing") {
      setProcessing(true);
      setPayment(undefined);
      setOpen(false);
      void restorePayment({ token: payment.token, clientSecret: payment.clientSecret });
      return;
    }
    setDone(registrationSuccessMessage(payment.requiresApproval, payment.partySize, true));
    setPayment(undefined);
    setOpen(false);
    clearResume();
  }, [clearResume, payment, restorePayment]);

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
      {done ? (
        <p ref={doneRef} tabIndex={-1} aria-live="polite" className="mt-4 text-sm">{done}</p>
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
          {canRegisterAgain
            ? <Button type="button" size="sm" onClick={startAgain}>Register again</Button>
            : resumeCredentials && <Button type="button" size="sm" variant="outline" onClick={() => void restorePayment(resumeCredentials)}>Try again</Button>}
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
