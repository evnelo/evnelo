import { WEBHOOK_EVENTS } from "@evnelo/core";
import { apiRoute, ok } from "@/lib/api";

export const runtime = "nodejs";

/** The event types a webhook can subscribe to. */
export const GET = apiRoute("read", async ({ auth }) => ok(auth, { data: [...WEBHOOK_EVENTS] }));
