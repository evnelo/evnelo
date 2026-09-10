"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { paymentHold, paymentOutcome, type PaymentOutcome } from "@/lib/payment-flow";

type Props = {
  clientSecret: string;
  publishableKey: string;
  stripeAccountId?: string | null;
  resumeToken: string;
  holdExpiresAt: string;
  onComplete: (outcome: PaymentOutcome) => void;
};

export function PaymentStep(props: Props) {
  const stripePromise = useMemo(
    () => loadStripe(props.publishableKey, props.stripeAccountId ? { stripeAccount: props.stripeAccountId } : undefined),
    [props.publishableKey, props.stripeAccountId],
  );
  return (
    <Elements stripe={stripePromise} options={{
      clientSecret: props.clientSecret,
      appearance: {
        theme: "stripe",
        variables: {
          colorPrimary: "#16603a", colorText: "#000000", colorDanger: "#a8341f", colorBackground: "#ffffff",
          colorTextSecondary: "#6a6b66", borderRadius: "10px", fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
        },
      },
    }}>
      <PaymentForm {...props} />
    </Elements>
  );
}

function PaymentForm({ resumeToken, holdExpiresAt, onComplete }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [hold, setHold] = useState(() => paymentHold(holdExpiresAt));

  useEffect(() => {
    const update = () => setHold(paymentHold(holdExpiresAt));
    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [holdExpiresAt]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || submittingRef.current || hold.expired) return;
    submittingRef.current = true;
    setSubmitting(true);
    setMessage(undefined);
    try {
      const returnUrl = new URL(window.location.pathname, window.location.origin);
      returnUrl.searchParams.set("ot_resume", resumeToken);
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl.toString() },
        redirect: "if_required",
      });
      if (result.error) {
        setMessage(result.error.message ?? "Your payment could not be completed. Try again.");
        return;
      }
      if (!result.paymentIntent) {
        setMessage("Complete the additional payment step to continue.");
        return;
      }
      const outcome = paymentOutcome(result.paymentIntent.status);
      if (outcome.state === "complete" || outcome.state === "processing") onComplete(outcome);
      else setMessage(outcome.message);
    } catch {
      setMessage("Stripe could not be reached. Your reservation is still available; try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const minutes = Math.floor(hold.seconds / 60);
  const seconds = String(hold.seconds % 60).padStart(2, "0");
  return (
    <form onSubmit={submit} className="space-y-5">
      <p className={`text-sm ${hold.expired ? "text-destructive" : "text-muted-foreground"}`} role={hold.expired ? "alert" : undefined}>
        {hold.expired ? "This ticket reservation expired. Close this window and register again." : `Tickets reserved for ${minutes}:${seconds}.`}
      </p>
      <div className="rounded-lg border bg-card p-3"><PaymentElement options={{ layout: "accordion" }} /></div>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <Button type="submit" variant="event" size="lg" className="w-full" disabled={!stripe || !elements || submitting || hold.expired}>
        {submitting ? <><Loader2 className="animate-spin" /> Processing payment…</> : hold.expired ? "Reservation expired" : "Pay and register"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Payments are securely processed by Stripe. OpenTicket does not store card details.</p>
    </form>
  );
}
