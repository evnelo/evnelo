/** Message keys live in messages/en/event.json; the caller translates with the "event" namespace. */
export type PaymentOutcome = { state: "complete" | "processing" | "retry" | "pending"; messageKey: "payment.outcome.received" | "payment.outcome.processing" | "payment.outcome.retry" | "payment.outcome.pending" };

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
      return { state: "complete", messageKey: "payment.outcome.received" };
    case "processing":
      return { state: "processing", messageKey: "payment.outcome.processing" };
    case "requires_payment_method":
    case "canceled":
      return { state: "retry", messageKey: "payment.outcome.retry" };
    default:
      return { state: "pending", messageKey: "payment.outcome.pending" };
  }
}

export type RegistrationSuccessMessage = {
  messageKey: "success.approvalPaid" | "success.approval" | "success.partyPaid" | "success.party" | "success.singlePaid" | "success.single";
  params: { count: number };
};

/** Which final message to show once a registration is settled; `params.count` is the party size. */
export function registrationSuccessMessage(requiresApproval: boolean, partySize: number, paid: boolean): RegistrationSuccessMessage {
  const params = { count: partySize };
  if (requiresApproval) return { messageKey: paid ? "success.approvalPaid" : "success.approval", params };
  if (partySize > 1) return { messageKey: paid ? "success.partyPaid" : "success.party", params };
  return { messageKey: paid ? "success.singlePaid" : "success.single", params };
}
