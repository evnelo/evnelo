"use client";

import { useEffect } from "react";

const viewed = new Set<string>();

/**
 * Tell the server this event page was viewed, or that the registration dialog was opened
 * (app/api/visit). One view per event per page load; the request is fire-and-forget and
 * keepalive, so leaving the page does not cancel it. Nothing is stored in the browser.
 */
export function sendVisit(eventId: string, milestone: "view" | "opened" = "view") {
  if (milestone === "view") {
    if (viewed.has(eventId)) return;
    viewed.add(eventId);
  }
  const body = JSON.stringify({ eventId, milestone, referrer: document.referrer || undefined, search: window.location.search || undefined });
  void fetch("/api/visit", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}

export function VisitBeacon({ eventId }: { eventId: string }) {
  useEffect(() => { sendVisit(eventId); }, [eventId]);
  return null;
}
