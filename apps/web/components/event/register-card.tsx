"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Clock, LoaderCircle } from "lucide-react";
import type { RegistrationField, TicketType } from "@evnelo/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RegisterForm } from "./register-form";
import { WaitlistJoin } from "./waitlist-join";
import { PaymentStep } from "./payment-step";
import { SuccessStep } from "./success-step";
import { cn, formatMoney } from "@/lib/utils";
import { paymentHold, paymentOutcome, registrationSuccessMessage, type PaymentOutcome } from "@/lib/payment-flow";
import type { Edition } from "@evnelo/core";
import { EVENTS } from "@/lib/analytics-events";
import { track } from "@/components/analytics";

type Props = {
  eventId: string; eventName: string; ticketTypes: TicketType[]; fields: RegistrationField[];
  collectPhone: boolean; requiresApproval: boolean; soldOut: boolean; guestsEnabled: boolean; maxGuests: number;
  stripePublishableKey?: string | null;
  pricing: { edition: Edition; feePassThrough: boolean };
  waitlist?: { enabled: boolean; offer: { email: string; expiresAt: string; ticketTypeName: string } | null };
};
type ResumeCredentials = { token: string; clientSecret: string };
type PaymentState = ResumeCredentials & {
  orderId: string; stripeAccountId?: string | null; holdExpiresAt: string; partySize: number; requiresApproval: boolean;
};
/** The settled outcome, shown inside the dialog first and summarised on the card once it closes. */
type SuccessState = { title: string; detail: string; message: string; orderUrl: string | null; celebrate: boolean };

/** Details → Payment, shown at the top of the dialog whenever a paid ticket is on offer. */
function Steps({ current }: { current: 1 | 2 }) {
  const t = useTranslations("event");
  const step = (n: 1 | 2, label: string) => {
    const done = n < current, active = n === current;
    return (
      <li className={cn("flex items-center gap-2", active ? "text-foreground" : "text-muted-foreground")} aria-current={active ? "step" : undefined}>
        <span className={cn("t-icon-swap size-6 rounded-full border text-[11px] font-semibold tabular-nums transition-[background-color,border-color,color] duration-(--duration-fast) ease-smooth-out", active && "border-event bg-event text-event-foreground", done && "border-event text-event")} data-state={done ? "b" : "a"}>
          <span className="t-icon" data-icon="a">{n}</span>
          <Check className="t-icon size-3.5" data-icon="b" aria-hidden />
        </span>
        <span className="text-xs font-medium">{label}</span>
      </li>
    );
  };
  return (
    <ol className="mb-4 flex items-center gap-3 pe-8" aria-label={t("register.steps")}>
      {step(1, t("register.stepDetails"))}
      <span aria-hidden className={cn("h-px w-8 transition-colors duration-(--duration-fast) ease-smooth-out", current === 2 ? "bg-event" : "bg-border")} />
      {step(2, t("register.stepPayment"))}
    </ol>
  );
}

/**
 * The dialog body. Each change of stage (form, payment, verifying) slides the new content in from the end side,
 * the page-slide recipe; the stage the dialog opened on and the success step (which has its own entrance) do not.
 */
function StepPane({ stage, children }: { stage: "form" | "payment" | "resuming" | "success"; children: React.ReactNode }) {
  const initial = useRef(stage);
  return <div key={stage} className={cn(stage !== "success" && "mt-5", stage !== "success" && stage !== initial.current && "animate-step")}>{children}</div>;
}

export function RegisterCard({ eventId, eventName, ticketTypes, fields, collectPhone, requiresApproval, soldOut, guestsEnabled, maxGuests, stripePublishableKey, pricing, waitlist }: Props) {
  const t = useTranslations("event");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<SuccessState>();
  const [success, setSuccess] = useState<SuccessState>();
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
  const free = ticketTypes.length > 0 && max === 0;
  const priceLabel = !ticketTypes.length || free ? null : min === max ? formatMoney(min, ticketTypes[0]!.currency, locale) : t("register.priceRange", { min: min === 0 ? tc("labels.free") : formatMoney(min, ticketTypes[0]!.currency, locale), max: formatMoney(max, ticketTypes[0]!.currency, locale) });
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

  const settled = useCallback((requiresApproval: boolean, partySize: number, paid: boolean, orderUrl: string | null | undefined): SuccessState => {
    const m = registrationSuccessMessage(requiresApproval, partySize, paid);
    const detailKey = m.messageKey.replace("success.", "success.detail.") as `success.detail.${string}`;
    return { title: t(requiresApproval ? "success.titleApproval" : "success.title"), detail: t(detailKey, m.params), message: t(m.messageKey, m.params), orderUrl: orderUrl ?? null, celebrate: !requiresApproval };
  }, [t]);

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
      if (!response.ok) throw new Error(result.error ?? t("errors.paymentNotVerified"));
      const outcome = paymentOutcome(result.paymentStatus);
      if (outcome.state === "complete" && result.orderStatus === "paid") {
        setProcessing(false);
        setPayment(undefined);
        setSuccess(settled(result.requiresApproval, result.partySize, true, result.orderUrl));
        setOpen(true);
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
        setOpen(false);
        setProcessing(false);
        setCanRegisterAgain(true);
        setResumeError(result.refunded ? t("payment.refundedLapsed") : t("payment.reservationClosed"));
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
      setPayment(undefined);
      setOpen(false);
      setResumeError(error instanceof Error ? error.message : t("errors.paymentNotVerified"));
    } finally {
      setResuming(false);
    }
  }, [clearResume, eventId, settled, t]);

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
  // A completed payment stays in the dialog ("verifying", then the success step); anything else closes it.
  const completePayment = useCallback((outcome: PaymentOutcome) => {
    if (!payment) return;
    setPayment(undefined);
    if (outcome.state === "processing") { setProcessing(true); setOpen(false); }
    void restorePayment({ token: payment.token, clientSecret: payment.clientSecret });
  }, [payment, restorePayment]);

  // closing the dialog after success moves the outcome onto the card
  const changeOpen = useCallback((next: boolean) => {
    if (!next && success) { setDone(success); setSuccess(undefined); }
    if (next) track(EVENTS.registrationOpened, { eventId, paid: paidPossible, requiresApproval });
    setOpen(next);
  }, [success, eventId, paidPossible, requiresApproval]);

  function startAgain() {
    setCanRegisterAgain(false);
    setResumeError(undefined);
    setProcessing(false);
    setOpen(true);
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-6 shadow-lift">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{requiresApproval ? t("register.eyebrowApproval") : guestsEnabled ? t("register.eyebrowGuests") : t("register.eyebrow")}</p>
          {priceLabel && (
            <p className="display mt-2 text-4xl tabular-nums">{priceLabel}</p>
          )}
          {free && <p className="mt-2"><Badge variant="stamp" className="text-primary">{tc("labels.free")}</Badge></p>}
        </div>
        {soldOut && <Badge variant="stamp" className="mt-1 shrink-0">{tc("labels.soldOut")}</Badge>}
      </div>
      {waitlist?.offer && !done && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-accent/70 px-3 py-2.5 text-xs text-accent-foreground">
          <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{t.rich("register.offerReserved", { ticketType: waitlist.offer.ticketTypeName, email: waitlist.offer.email, time: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(waitlist.offer.expiresAt)), b: (chunks) => <strong>{chunks}</strong> })}</span>
        </p>
      )}
      {done ? (
        <div ref={doneRef} tabIndex={-1} aria-live="polite" className="mt-4 rounded-lg bg-accent/70 px-3 py-3 text-sm text-accent-foreground">
          <p className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden /><span>{done.message}</span></p>
          {done.orderUrl && (
            <Button asChild variant="event" size="sm" className="mt-3">
              <a href={done.orderUrl}>{t("success.viewTickets")}</a>
            </Button>
          )}
        </div>
      ) : soldOut && waitlist?.enabled ? (
        <WaitlistJoin eventId={eventId} eventName={eventName} />
      ) : processing ? (
        <div className="mt-4 space-y-2" aria-live="polite">
          <p className="text-sm">{t("payment.processingNotice")}</p>
          {resumeError && <p className="text-sm text-destructive">{resumeError}</p>}
          {resumeCredentials && <Button type="button" size="sm" variant="outline" pending={resuming} onClick={() => void restorePayment(resumeCredentials)}>{t("payment.check")}</Button>}
        </div>
      ) : resuming ? (
        <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">{t("payment.verifying")}</p>
      ) : resumeError ? (
        <div className="mt-4 space-y-2" role="alert">
          <p className="text-sm text-destructive">{resumeError}</p>
          <div className="flex flex-wrap gap-2">
            {!canRegisterAgain && resumeCredentials && <Button type="button" size="sm" variant="outline" onClick={() => void restorePayment(resumeCredentials)}>{t("payment.checkAgain")}</Button>}
            <Button type="button" size="sm" variant={canRegisterAgain ? "default" : "ghost"} onClick={() => { clearResume(); startAgain(); }}>{t("payment.registerAgain")}</Button>
          </div>
        </div>
      ) : (
        <Dialog open={open} onOpenChange={changeOpen}>
          <DialogTrigger asChild>
            <Button variant="event" size="lg" className="mt-5 w-full" disabled={soldOut || !ticketTypes.length}>
              {soldOut ? tc("labels.soldOut") : requiresApproval ? t("register.buttonApproval") : t("register.button")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            {paidPossible && !success && <Steps current={payment || resuming ? 2 : 1} />}
            {!success && <DialogTitle>{payment ? t("register.dialogPayTitle") : eventName}</DialogTitle>}
            {!success && <DialogDescription>{payment ? t("register.dialogPayDescription") : t("register.dialogDescription")}</DialogDescription>}
            <StepPane stage={success ? "success" : payment && stripePublishableKey ? "payment" : resuming ? "resuming" : "form"}>
              {success ? (
                <SuccessStep title={success.title} message={success.detail} orderUrl={success.orderUrl} celebrate={success.celebrate} />
              ) : payment && stripePublishableKey ? (
                <PaymentStep clientSecret={payment.clientSecret} stripeAccountId={payment.stripeAccountId} resumeToken={payment.token} holdExpiresAt={payment.holdExpiresAt} publishableKey={stripePublishableKey} onComplete={completePayment} />
              ) : resuming ? (
                <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" aria-live="polite">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden /> {t("payment.verifying")}
                </p>
              ) : (
                <RegisterForm eventId={eventId} ticketTypes={ticketTypes} fields={fields} collectPhone={collectPhone}
                  guestsEnabled={guestsEnabled} maxGuests={maxGuests} pricing={pricing}
                  onSubmitted={(result) => {
                    if (result.clientSecret && result.resumeToken && result.holdExpiresAt) {
                      const credentials = { token: result.resumeToken, clientSecret: result.clientSecret };
                      persistResume(credentials);
                      setPayment({ ...credentials, orderId: result.orderId, stripeAccountId: result.stripeAccountId, holdExpiresAt: result.holdExpiresAt, partySize: result.partySize, requiresApproval });
                    } else if (!result.clientSecret) {
                      setSuccess(settled(requiresApproval, result.partySize, false, result.orderUrl));
                    } else {
                      setResumeError(t("payment.couldNotStart"));
                      setOpen(false);
                    }
                  }} />
              )}
            </StepPane>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
