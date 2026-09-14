/**
 * The product analytics taxonomy, one name per meaningful moment. Attendee-side events are anonymous
 * (no person profile, the order id ties a checkout together); host-side events are identified by user id
 * and grouped by organization. Property values are ids and enums, never names or emails.
 */
export const EVENTS = {
  // attendee side (public pages)
  eventPageViewed: "event_page_viewed",
  registrationOpened: "registration_opened",
  registrationSubmitted: "registration_submitted",
  discountApplied: "discount_applied",
  paymentStarted: "payment_started",
  paymentSucceeded: "payment_succeeded",
  paymentFailed: "payment_failed",
  orderPageViewed: "order_page_viewed",
  ticketViewed: "ticket_viewed",
  walletAdded: "wallet_added",
  // host side (dashboard)
  signedIn: "signed_in",
  organizationCreated: "organization_created",
  eventCreated: "event_created",
  eventPublished: "event_published",
  stripeConnected: "stripe_connected",
  attendeeApproved: "attendee_approved",
  refundRequested: "refund_requested",
  checkinScanned: "checkin_scanned",
  apiKeyCreated: "api_key_created",
  webhookAdded: "webhook_added",
  exportDownloaded: "export_downloaded",
} as const;

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];
