import { rejectAttendees } from "@evnelo/core/services";
import { attendeeAction } from "../action";

export const runtime = "nodejs";

/** Reject a pending registration: seat returned, one email queued. Paid orders are refunded separately. */
export const POST = attendeeAction("rejected", "pending", rejectAttendees);
