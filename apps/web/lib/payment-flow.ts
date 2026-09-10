export type PaymentOutcome = { state: "complete" | "processing" | "retry" | "pending"; message: string };

export function paymentHold(expiresAt: string, now = new Date()) {
  const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 1000));
  return { expired: seconds === 0, seconds };
}

export function checkoutStripeAccount(edition: "self_hosted" | "cloud", stripeAccountId?: string | null) {
  return edition === "cloud" ? stripeAccountId ?? null : null;
}

export function paymentsConfigured(secretKey?: string, publishableKey?: string) {
  return Boolean(secretKey && publishableKey);
}

export function paymentOutcome(status: string): PaymentOutcome {
  switch (status) {
    case "succeeded":
      return { state: "complete", message: "Payment received." };
    case "processing":
      return { state: "processing", message: "Your payment is processing. We'll email your ticket when it completes." };
    case "requires_payment_method":
    case "canceled":
      return { state: "retry", message: "Your payment was not completed. Choose another payment method and try again." };
    default:
      return { state: "pending", message: "Complete the additional payment step to continue." };
  }
}

export function registrationSuccessMessage(requiresApproval: boolean, partySize: number, paid: boolean) {
  if (requiresApproval) return `${paid ? "Payment received. " : ""}Request sent. You'll get an email once the host approves it.`;
  if (partySize > 1) return `${paid ? "Payment received. " : ""}You're in, all ${partySize} of you. The tickets are on their way to your inbox.`;
  return `${paid ? "Payment received. " : ""}You're in. Your ticket is on its way to your inbox.`;
}
